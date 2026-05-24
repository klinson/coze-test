'use strict';

/**
 * 校验聊天请求必要参数
 */
function validateChatRequest(req, res, next) {
  const { api_key, bot_id, base_url, messages } = req.body;

  if (!api_key || typeof api_key !== 'string' || api_key.trim() === '') {
    return res.status(400).json({ error: '缺少 api_key 参数' });
  }
  if (!bot_id || typeof bot_id !== 'string' || bot_id.trim() === '') {
    return res.status(400).json({ error: '缺少 bot_id 参数' });
  }
  if (!base_url || !['https://api.coze.cn', 'https://api.coze.com'].includes(base_url)) {
    return res.status(400).json({ error: 'base_url 无效，请选择国内或国际服务' });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' });
  }

  next();
}

/**
 * 校验消息拉取请求必要参数
 */
function validateMessagesRequest(req, res, next) {
  const { api_key, bot_id, base_url, chat_id, conversation_id } = req.query;

  if (!api_key || api_key.trim() === '') {
    return res.status(400).json({ error: '缺少 api_key 参数' });
  }
  if (!bot_id || bot_id.trim() === '') {
    return res.status(400).json({ error: '缺少 bot_id 参数' });
  }
  if (!base_url || !['https://api.coze.cn', 'https://api.coze.com'].includes(base_url)) {
    return res.status(400).json({ error: 'base_url 无效' });
  }
  if (!chat_id || chat_id.trim() === '') {
    return res.status(400).json({ error: '缺少 chat_id 参数' });
  }
  if (!conversation_id || conversation_id.trim() === '') {
    return res.status(400).json({ error: '缺少 conversation_id 参数' });
  }

  next();
}

module.exports = { validateChatRequest, validateMessagesRequest };
