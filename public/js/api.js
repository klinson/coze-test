/**
 * api.js — 前端接口请求封装
 */

/**
 * 发送流式聊天请求
 * 返回 Response 对象，由 stream.js 处理
 * @param {Object} params
 * @param {AbortSignal} signal
 * @returns {Promise<Response>}
 */
async function fetchChatStream(params, signal) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  if (!response.ok) {
    let errMsg = `请求失败 (${response.status})`;
    try {
      const data = await response.json();
      errMsg = data.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  return response;
}

/**
 * 拉取指定 chat 的完整消息（流式中断恢复）
 * @param {Object} params
 * @returns {Promise<{thinking: string, answer: string, status: string}>}
 */
async function fetchMessages(params) {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`/api/messages?${qs}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `请求失败 (${response.status})`);
  }

  return data;
}

window.Api = { fetchChatStream, fetchMessages };
