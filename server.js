'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const chatRouter = require('./routes/chat');
const messagesRouter = require('./routes/messages');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── 安全中间件 ───────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // marked.js / highlight.js 内联脚本
          'cdn.jsdelivr.net',
          'cdnjs.cloudflare.com',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'cdn.jsdelivr.net',
          'cdnjs.cloudflare.com',
          'fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

app.use(cors());

// ─── 请求体解析 ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── 限流：防止 API Key 超额 ──────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟窗口
  max: 60,             // 每 IP 每分钟最多 60 次
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后重试' },
});
app.use('/api', apiLimiter);

// ─── API 路由 ─────────────────────────────────────────────────
app.use('/api/chat', chatRouter);
app.use('/api/messages', messagesRouter);

// ─── 静态文件托管 ─────────────────────────────────────────────
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
  })
);

// ─── SPA 回退（所有未匹配路由返回 index.html）────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── 全局错误处理 ─────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// ─── 启动服务 ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Coze Chat 服务已启动`);
  console.log(`   本地访问: http://localhost:${PORT}`);
  console.log(`   Node.js:  ${process.version}\n`);
});

module.exports = app;
