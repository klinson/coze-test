'use strict';

const express = require('express');
const { CozeAPI } = require('@coze/api');
const { validateMessagesRequest } = require('../middleware/validate');

const router = express.Router();

/**
 * GET /api/messages
 * 拉取指定 chat 的完整消息列表，用于流式中断后的内容恢复
 */
router.get('/', validateMessagesRequest, async (req, res) => {
  const { api_key, bot_id, base_url, chat_id, conversation_id } = req.query;

  const client = new CozeAPI({
    token: api_key.trim(),
    baseURL: base_url,
  });

  try {
    // 先查询 chat 状态，判断是否可以拉取消息
    const chatDetail = await client.chat.retrieve({
      conversation_id: conversation_id.trim(),
      chat_id: chat_id.trim(),
    });

    const status = chatDetail.status;

    // chat 仍在进行中，消息可能不完整
    if (status === 'in_progress' || status === 'created') {
      return res.status(202).json({
        error: 'chat 仍在进行中，请稍后重试',
        status,
      });
    }

    // chat 失败
    if (status === 'failed' || status === 'requires_action') {
      return res.status(200).json({
        status,
        thinking: '',
        answer: '',
        error: chatDetail.last_error?.msg || 'Chat 执行失败',
      });
    }

    // 拉取消息列表
    const msgList = await client.chat.messages.list({
      conversation_id: conversation_id.trim(),
      chat_id: chat_id.trim(),
    });

    let thinking = '';
    let answer = '';

    // 遍历消息，提取 assistant 的思考和回答内容
    for (const msg of msgList) {
      if (msg.role !== 'assistant') continue;

      if (msg.type === 'answer') {
        answer = msg.content || '';
      } else if (msg.type === 'reasoning_content') {
        thinking = msg.content || '';
      }
    }

    return res.json({ status, thinking, answer });
  } catch (err) {
    const errMsg = err?.message || '拉取消息失败';
    return res.status(500).json({ error: errMsg });
  }
});

module.exports = router;
