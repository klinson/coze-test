'use strict';

const express = require('express');
const { CozeAPI, ChatEventType, RoleType } = require('@coze/api');
const { validateChatRequest } = require('../middleware/validate');

const router = express.Router();

/**
 * POST /api/chat/stream
 * 接收前端消息，调用 Coze SDK 流式接口，以 SSE 格式转发给浏览器
 */
router.post('/stream', validateChatRequest, async (req, res) => {
  const { api_key, bot_id, base_url, conversation_id, messages } = req.body;

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁止 Nginx 缓冲
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // SSE 发送工具函数
  const sendEvent = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) {
      // 客户端已断开，忽略写入错误
    }
  };

  // 初始化 Coze 客户端（每次请求独立实例，支持多并发）
  const client = new CozeAPI({
    token: api_key.trim(),
    baseURL: base_url,
  });

  // 构造消息列表
  const additionalMessages = messages.map((msg) => ({
    role: msg.role === 'user' ? RoleType.User : RoleType.Assistant,
    content: msg.content,
    content_type: 'text',
  }));

  let stream = null;

  // 客户端断开时清理 stream
  req.on('close', () => {
    if (stream) {
      try {
        stream.controller?.abort();
      } catch (_) {}
    }
  });

  try {
    const streamParams = {
      bot_id: bot_id.trim(),
      additional_messages: additionalMessages,
      auto_save_history: true,
    };

    // 如果有 conversation_id，传入以保持对话上下文
    if (conversation_id && conversation_id.trim() !== '') {
      streamParams.conversation_id = conversation_id.trim();
    }

    stream = await client.chat.stream(streamParams);

    for await (const event of stream) {
      const { event: eventType, data } = event;

      switch (eventType) {
        // 对话创建，推送 meta 信息（chat_id + conversation_id）
        case ChatEventType.CONVERSATION_CHAT_CREATED:
          sendEvent({
            type: 'meta',
            chat_id: data.id,
            conversation_id: data.conversation_id,
          });
          break;

        // 增量消息内容
        case ChatEventType.CONVERSATION_MESSAGE_DELTA: {
          const contentType = data.type; // 'answer' | 'reasoning_content' 等
          const content = data.content || '';

          if (contentType === 'answer') {
            sendEvent({ type: 'answer', content });
          } else if (contentType === 'reasoning_content') {
            sendEvent({ type: 'thinking', content });
          }
          // 其他类型（function_call 等）暂不处理
          break;
        }

        // 某条消息完成（不代表整轮对话结束）
        case ChatEventType.CONVERSATION_MESSAGE_COMPLETED:
          // 可用于未来扩展，暂不处理
          break;

        // 整轮对话完成
        case ChatEventType.CONVERSATION_CHAT_COMPLETED:
          sendEvent({ type: 'done' });
          break;

        // 对话失败
        case ChatEventType.CONVERSATION_CHAT_FAILED:
          sendEvent({
            type: 'error',
            message: data?.last_error?.msg || '对话失败，请重试',
          });
          break;

        // SSE 流结束标志
        case ChatEventType.DONE:
          break;

        default:
          break;
      }
    }
  } catch (err) {
    // 客户端主动断开不报错
    if (err.name === 'AbortError') {
      return res.end();
    }

    const errMsg = err?.message || '服务器内部错误';
    sendEvent({ type: 'error', message: errMsg });
  } finally {
    res.end();
  }
});

module.exports = router;
