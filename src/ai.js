const log = require('./log');

// DeepSeek 配置（运行时由设置面板注入）
let config = {
  apiKey: '',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
};

function setConfig(c) {
  if (!c) return;
  if (typeof c.apiKey === 'string') config.apiKey = c.apiKey.trim();
  if (typeof c.model === 'string' && c.model) config.model = c.model;
  if (typeof c.baseUrl === 'string' && c.baseUrl) config.baseUrl = c.baseUrl.replace(/\/+$/, '');
}

function hasKey() {
  return !!config.apiKey;
}

function buildPrompt(questions) {
  const list = questions.map((q) => {
    const opts = (q.options || [])
      .map((o) => `${o.value}. ${o.text}`)
      .join('\n');
    if (q.type === 'essay' || q.hasTextarea) {
      return `第${q.index}题（简答）：${q.stem}`;
    }
    return `第${q.index}题（${q.type === 'multi' ? '多选' : '单选'}）：${q.stem}\n${opts}`;
  }).join('\n\n');
  return `以下是学习通作业题目，请作答。\n\n${list}\n\n` +
    '要求：\n' +
    '1. 选择题给出正确选项字母，多选按字母顺序拼接（如 "AC"）；\n' +
    '2. 简答题给出简洁、准确的文字答案（100 字以内）；\n' +
    '3. 只输出 JSON，格式为 {"answers":[{"index":1,"answer":"B"},{"index":2,"answer":"简述..."}]}，不要输出任何解释。';
}

/**
 * 调用 DeepSeek 对题目作答。
 * @param {Array} questions [{ index, type, stem, options }]
 * @returns {Promise<Array>} [{ index, answer }]
 */
async function answer(questions) {
  if (!config.apiKey) {
    throw new Error('未配置 DeepSeek API Key');
  }
  if (!questions || !questions.length) return [];

  const body = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: '你是学习通课程的作业答题助手，擅长各学科选择题与简答题。只输出 JSON，不输出解释。',
      },
      { role: 'user', content: buildPrompt(questions) },
    ],
    temperature: 0.2,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  };

  const url = `${config.baseUrl}/chat/completions`;
  log.info(`调用 AI 答题（${questions.length} 题，模型 ${config.model}）`);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`AI 接口返回 ${resp.status}：${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (!content) throw new Error('AI 返回内容为空');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI 返回不是有效 JSON');
    parsed = JSON.parse(m[0]);
  }

  const answers = Array.isArray(parsed) ? parsed : parsed.answers;
  if (!Array.isArray(answers)) throw new Error('AI 返回缺少 answers 数组');

  log.info(`AI 返回 ${answers.length} 个答案`);
  return answers.map((a) => ({
    index: Number(a.index),
    answer: a.answer == null ? '' : String(a.answer).trim(),
  }));
}

module.exports = { setConfig, hasKey, answer };
