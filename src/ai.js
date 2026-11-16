const log = require('./log');

// DeepSeek 配置（运行时由设置面板注入）
let config = {
  apiKey: '',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
  style: 'concise',
};

function setConfig(c) {
  if (!c) return;
  if (typeof c.apiKey === 'string') config.apiKey = c.apiKey.trim();
  if (typeof c.model === 'string' && c.model) config.model = c.model;
  if (typeof c.baseUrl === 'string' && c.baseUrl) config.baseUrl = c.baseUrl.replace(/\/+$/, '');
  if (typeof c.style === 'string' && c.style) config.style = c.style;
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
    if (q.type === 'judge') {
      return `第${q.index}题（判断）：${q.stem}\n选项：${opts || '对/错'}`;
    }
    return `第${q.index}题（${q.type === 'multi' ? '多选' : '单选'}）：${q.stem}\n${opts}`;
  }).join('\n\n');

  const styleTip = config.style === 'detailed'
    ? '简答题给出详细完整的回答（200 字以内），分点说明。'
    : config.style === 'english'
      ? '所有答案使用英文。'
      : '简答题给出简洁准确的回答（100 字以内）。';

  return `以下是学习通作业题目，请作答。\n\n${list}\n\n` +
    '要求：\n' +
    '1. 选择题：只输出选项字母（如 "B" 或 "AC"），多选按字母顺序拼接；\n' +
    '2. 判断题：只输出"对"或"错"；\n' +
    `3. ${styleTip}\n` +
    '4. 只输出 JSON，格式为 {"answers":[{"index":1,"answer":"B"},{"index":2,"answer":"简述..."}]}，不要输出任何解释。';
}

/** 单批请求（最多 10 题） */
async function answerBatch(questions) {
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

  return answers.map((a) => ({
    index: Number(a.index),
    answer: a.answer == null ? '' : String(a.answer).trim(),
  }));
}

/** 校验答案：选择题字母必须在选项内，判断题归一化 */
function validateAnswer(ans, questions) {
  const q = questions.find((x) => x.index === ans.index);
  if (!q) return { ...ans, ok: !!ans.answer };
  let answer = String(ans.answer || '').trim();

  if (q.type === 'judge') {
    if (/^(对|正确|true|是|√|T)$/i.test(answer)) answer = '对';
    else if (/^(错|错误|false|否|×|F)$/i.test(answer)) answer = '错';
    return { index: ans.index, answer, type: 'judge', ok: !!answer };
  }

  if (q.type === 'single' || q.type === 'multi') {
    const letters = answer.toUpperCase().replace(/[^A-Z]/g, '');
    const valid = (q.options || [])
      .map((o) => String(o.value || '').toUpperCase())
      .filter((v) => /^[A-Z]$/.test(v));
    const filtered = letters.split('').filter((l) => valid.includes(l));
    answer = filtered.join('');
    return { index: ans.index, answer, type: q.type, ok: !!answer };
  }

  return { index: ans.index, answer, type: q.type, ok: !!answer };
}

/**
 * 调用 DeepSeek 对题目作答（分批 + 重试 + 校验）。
 * @param {Array} questions [{ index, type, stem, options }]
 * @returns {Promise<Array>} [{ index, answer, type, ok }]
 */
async function answer(questions) {
  if (!config.apiKey) {
    throw new Error('未配置 DeepSeek API Key');
  }
  if (!questions || !questions.length) return [];

  const batches = [];
  for (let i = 0; i < questions.length; i += 10) batches.push(questions.slice(i, i + 10));

  log.info(`调用 AI 答题（${questions.length} 题，${batches.length} 批，模型 ${config.model}）`);

  const all = [];
  for (let bi = 0; bi < batches.length; bi++) {
    let res = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await answerBatch(batches[bi]);
        break;
      } catch (e) {
        if (attempt === 1) {
          log.error(`第 ${bi + 1} 批答题失败：${e.message}`);
          throw e;
        }
        log.warn(`第 ${bi + 1} 批答题失败，1.5 秒后重试：${e.message}`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (res) all.push(...res);
  }

  const validated = all.map((a) => validateAnswer(a, questions));
  const bad = validated.filter((a) => !a.ok).length;
  log.info(`AI 返回 ${validated.length} 个答案${bad ? `，其中 ${bad} 个需人工确认` : ''}`);
  return validated;
}

module.exports = { setConfig, hasKey, answer };
