/**
 * stream.js — SSE 流式接收与解析
 * 支持多路并发，每路独立 AbortController
 */

/**
 * 读取 SSE 流，逐事件回调
 * @param {Response} response
 * @param {Object} callbacks
 * @param {function} callbacks.onMeta      收到 meta 事件（chat_id, conversation_id）
 * @param {function} callbacks.onThinking  收到思考片段
 * @param {function} callbacks.onAnswer    收到正文片段
 * @param {function} callbacks.onDone      流正常结束
 * @param {function} callbacks.onError     收到错误事件
 */
async function readStream(response, callbacks) {
  const { onMeta, onThinking, onAnswer, onDone, onError } = callbacks;

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按 \n\n 分割 SSE 帧
      const frames = buffer.split('\n\n');
      buffer = frames.pop(); // 最后一段可能不完整，留在 buffer

      for (const frame of frames) {
        if (!frame.trim()) continue;

        // 提取 data 行（可能有多行，合并）
        const lines = frame.split('\n');
        const dataLines = lines
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trim());

        if (dataLines.length === 0) continue;
        const raw = dataLines.join('');

        // 跳过 DONE 标志
        if (raw === '[DONE]') continue;

        let event;
        try {
          event = JSON.parse(raw);
        } catch {
          continue; // 解析失败跳过
        }

        switch (event.type) {
          case 'meta':
            onMeta?.(event);
            break;
          case 'thinking':
            onThinking?.(event.content || '');
            break;
          case 'answer':
            onAnswer?.(event.content || '');
            break;
          case 'done':
            onDone?.();
            break;
          case 'error':
            onError?.(event.message || '未知错误');
            break;
          default:
            break;
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      // 用户主动中断，不视为错误
      return;
    }
    onError?.(err.message || '流式读取失败');
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

window.Stream = { readStream };
