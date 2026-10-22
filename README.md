# xxt-Get — 学习通刷课助手

基于 **Playwright + Electron** 的学习通自动刷课工具，带悬浮置顶小窗控制、断点续跑与防封策略。

> 仅供学习与技术交流使用，请遵守平台规则。

---

## ✨ 功能特性

- **悬浮置顶小窗**：始终显示在最上层，随时开始/暂停/停止，实时进度与日志。
- **课程多选**：自动读取「我的课程」列表，勾选要刷的课程。
- **视频自动播放**：支持 0.5x / 1x / 1.5x / 2x 倍速，自动处理 iframe 播放器与「继续观看」弹窗。
- **按真实状态跳过**：逐章节读取页面状态，已完成的直接跳过，不做任何多余操作。
- **文档渐进滚动**：文档类任务自动滚动阅读（默认 30 秒）。
- **断点续跑**：记录完成断点，支持中断后继续；自动识别并清理脏断点。
- **防封策略**：人类化随机延迟、鼠标轨迹抖动、播放中随机暂停、人工验证检测、单日学习时长上限。
- **日志管理**：运行日志自动轮转，保留 7 天后自动清理。

---

## 🧱 技术栈

| 组件 | 用途 |
|---|---|
| Node.js | 运行环境 |
| Playwright (playwright-core) | 驱动系统 Edge，页面自动化 |
| Electron | 悬浮置顶控制窗口 |

---

## 📦 环境要求

- Windows 10/11
- Node.js >= 18
- Microsoft Edge（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`）
- 可访问学习通的网络

---

## 📥 下载与安装

### Windows

| 版本 | 文件 | 说明 |
|---|---|---|
| 安装版 | `xxt-Get-Setup-1.0.0.exe` | 双击安装向导，可自选安装目录；自带卸载程序（设置 → 应用 → 卸载） |
| 便携版 | `xxt-Get-Portable-1.0.0.exe` | 单文件免安装，可放 U 盘随身携带，数据跟随 exe 目录 |

> 安装/卸载界面为中文向导，安装版会在桌面和开始菜单创建「xxt-Get 学习通刷课助手」快捷方式。

### macOS

通过 GitHub Actions 构建（mac 产物需在 macOS 环境生成）：

1. 打开仓库 **Actions → Build → Run workflow**
2. 运行完成后在 Artifacts 下载 `dist-macos-latest`（含 `.dmg` 与 `.zip`）

macOS 安装：打开 dmg，把 `xxt-Get.app` 拖进「应用程序」；卸载：从「应用程序」拖到废纸篓。

### 从源码运行

```bash
git clone https://github.com/lijunyi911/xxt-Get.git
cd xxt-Get
npm install
npm start
```

---

## ▶️ 使用

1. 双击 **`启动刷课.bat`**（或运行 `npm start`）。
2. 首次启动会打开**专用 Edge**（独立 profile：`D:\xxt-edge-profile`），在该窗口登录学习通（登录态会持久保存）。
3. 悬浮窗点击 **「读取我的课程」**，等待课程列表加载。
4. 勾选要刷的课程、选择倍速，点击 **「开始刷课」**。
5. 刷课过程中可随时 **暂停 / 停止**；若检测到人脸识别或验证码，会自动停止，请手动完成后继续。
6. 想整门课重刷时，点击 **「清除断点重刷」**。

### 命令行模式（备用）

```bash
node run.js
```

---

## ⚙️ 配置说明

配置文件：`config.js`

| 配置项 | 说明 |
|---|---|
| `profileDir` | 专用 Edge 用户数据目录 |
| `speeds` / `defaultSpeed` | 倍速档位与默认倍速 |
| `docDwellMs` | 文档阅读停留时长（默认 30000ms） |
| `docFallbackMs` | 未知任务点兜底滚动时长 |
| `antiBan.*` | 防封策略参数（延迟、鼠标抖动、随机暂停、单日上限等） |
| `logRetentionDays` | 日志保留天数（默认 7 天） |

### 防封参数

```js
antiBan: {
  enabled: true,
  minDelayMs: 500,
  maxDelayMs: 2000,
  mouseJitter: true,
  randomPauseChance: 0.2,
  dailyLimitMinutes: 240,
  chapterGapMinMs: 2000,
  chapterGapMaxMs: 6000,
}
```

---

## 📁 目录结构

```
xxt-Get/
├── main.js              # Electron 主进程（悬浮窗 + IPC）
├── preload.js           # 预加载脚本
├── run.js               # 命令行入口
├── config.js            # 全局配置
├── cleanup_logs.js      # 日志清理脚本
├── 启动刷课.bat          # 一键启动
├── src/
│   ├── engine.js        # 刷课主流程编排
│   ├── profile.js       # 专用 Edge 启动
│   ├── course.js        # 课程列表读取
│   ├── player.js        # 视频/文档/状态检测
│   ├── humanize.js      # 人类化延迟与鼠标抖动
│   ├── daily.js         # 单日学习时长统计
│   ├── state.js         # 断点续跑与校验
│   ├── log.js           # 日志与清理
│   ├── quiz_capture.js  # 作业采题截图
│   └── quiz_submit.js   # 作业答案回填
├── web/                 # 悬浮窗界面
│   ├── index.html
│   ├── renderer.js
│   └── style.css
└── data/                # 运行数据（日志/断点/答案，已 gitignore）
```

---

## 📝 日志

- 位置：`data/run.log`
- 单个文件超过 5MB 自动轮转
- 保留 7 天，超期自动删除（应用启动时 + 每周计划任务）
- 记录章节状态、视频进度、文档阅读、人工验证等关键信息

---

## ⚠️ 注意事项

- 本工具仅用于学习与研究，使用后果由使用者自行承担。
- 学习通反作弊机制持续更新，防封策略无法保证 100% 安全。
- 遇到人脸识别、验证码、滑块等人工验证时脚本会自动停止，需手动完成后再继续。
- 建议合理控制单日学习时长与倍速，避免异常行为。

---

## 📄 License

MIT（见 LICENSE 文件）
