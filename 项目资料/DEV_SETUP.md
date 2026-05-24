# Coze Chat — 本地开发环境配置说明

## 环境要求

| 依赖 | 版本要求 | 检查命令 |
|---|---|---|
| Node.js | >= 22.0.0 | `node -v` |
| npm | >= 10.0.0 | `npm -v` |
| 操作系统 | macOS / Linux / Windows | — |

---

## 第一步：解压项目

```bash
tar -xzf coze-chat.tar.gz
cd coze-chat
```

---

## 第二步：安装依赖

```bash
npm install
```

安装完成后 `node_modules/` 目录下应包含以下核心包：

- `@coze/api` — Coze 官方 Node.js SDK
- `express` — Web 框架
- `helmet` — 安全响应头
- `cors` — 跨域支持
- `express-rate-limit` — 请求限流

---

## 第三步：启动服务

### 普通启动

```bash
npm start
# 或
node server.js
```

### 热重载启动（推荐开发时使用，Node.js 22 原生支持）

```bash
npm run dev
# 等价于：node --watch server.js
```

`--watch` 模式下，修改任意 `.js` 文件后服务自动重启，无需手动操作。  
修改 `public/` 下的前端文件无需重启，刷新浏览器即可生效。

### 自定义端口

```bash
PORT=8080 node server.js
```

默认端口为 **3000**。

---

## 第四步：访问应用

启动成功后终端输出：

```
🚀 Coze Chat 服务已启动
   本地访问: http://localhost:3000
   Node.js:  v22.x.x
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 第五步：配置 Coze 参数

进入页面后，在左下角「**配置**」面板中填写以下三项：

### API Key

1. 登录 [coze.cn](https://www.coze.cn)（国内）或 [coze.com](https://www.coze.com)（国际）
2. 进入「个人设置」→「API Token」→「添加新 Token」
3. 复制生成的 Token，格式为 `pat_xxxxxxxxxxxxxxxxxxxxxxxx`

### Bot ID

1. 在 Coze 平台打开你的智能体
2. 点击右上角「发布」，确保已发布 API 渠道
3. 在智能体页面 URL 中找到 Bot ID，格式为纯数字，例如：

   ```
   https://www.coze.cn/space/xxx/bot/7xxxxxxxxxxxxxxxxx
                                        ↑ 这串数字即为 Bot ID
   ```

### 服务区域

| 选项 | 适用场景 |
|---|---|
| 🇨🇳 国内版 (coze.cn) | 使用 coze.cn 创建的 Bot |
| 🌐 国际版 (coze.com) | 使用 coze.com 创建的 Bot |

填写完毕后点击「**保存配置**」，按钮变绿即表示保存成功。

> **注意**：配置信息存储在浏览器 `localStorage` 中，不会上传到服务器，刷新页面后自动保留。

---

## 目录结构说明

```
coze-chat/
├── server.js              # Express 服务端主入口
├── package.json
├── middleware/
│   └── validate.js        # 接口参数校验
├── routes/
│   ├── chat.js            # POST /api/chat/stream（流式对话）
│   └── messages.js        # GET /api/messages（中断恢复）
└── public/                # 前端静态文件（Express 直接托管）
    ├── index.html
    ├── css/
    └── js/
```

---

## 常见问题

### Q：启动后页面空白或报错

检查终端是否有报错信息，常见原因：

- 端口被占用：换端口 `PORT=8080 node server.js`
- 依赖未安装：重新执行 `npm install`

### Q：发送消息后提示「请求失败」

1. 确认 API Key 和 Bot ID 填写正确，没有多余空格
2. 确认服务区域选择与你的 Bot 所在平台一致
3. 打开浏览器开发者工具（F12）→「网络」标签，查看 `/api/chat/stream` 请求的响应详情

### Q：思考过程没有显示

思考内容取决于 Bot 使用的模型是否开启了深度思考（reasoning）功能。如果 Bot 配置的模型不支持或未开启深度思考，思考块不会出现，属于正常现象。

### Q：流式中断后如何恢复

页面刷新后，未完成的 AI 消息气泡底部会出现「**↻ 拉取完整回复**」按钮，点击后将从 Coze 服务器拉取该轮对话的完整内容并渲染。

> 前提：Coze 服务端的对话记录未超时失效（`auto_save_history: true` 已开启）。

---

## 开发调试技巧

### 查看 SSE 流原始数据

```bash
curl -N -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "你的APIKey",
    "bot_id": "你的BotID",
    "base_url": "https://api.coze.cn",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 查看请求日志

Node.js 22 可以通过环境变量开启更详细的日志：

```bash
NODE_DEBUG=http node server.js
```

### 清空本地数据

在浏览器控制台执行：

```javascript
// 清空所有 Coze Chat 数据（保留其他网站数据）
Object.keys(localStorage)
  .filter(k => k.startsWith('coze_'))
  .forEach(k => localStorage.removeItem(k));
location.reload();
```
