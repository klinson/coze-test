/**
 * chat.js — 对话区核心逻辑
 * 负责：消息渲染、流式接收、并发管理、中断恢复
 */

// ─── DOM 引用 ────────────────────────────────
const messagesContainer = document.getElementById('messages-container');
const emptyState        = document.getElementById('empty-state');
const chatHeader        = document.getElementById('chat-header-title');
const chatInput         = document.getElementById('chat-input');
const btnSend           = document.getElementById('btn-send');
const btnStop           = document.getElementById('btn-stop');
const inputHint         = document.getElementById('input-hint');

// ─── 并发状态 Map ─────────────────────────────
// key: convId
// value: { thinkingBuffer, answerBuffer, status, chat_id, conversation_id, abortController, msgId }
const streamingMap = new Map();

// 当前展示的对话 ID
let currentConvId = null;

// ─── 工具：转义 HTML ─────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── 显示空态 ────────────────────────────────
function showEmpty() {
  currentConvId = null;
  messagesContainer.innerHTML = '';
  emptyState.classList.remove('hidden');
  chatHeader.textContent = 'Coze Chat';
  updateInputState();
}

// ─── 加载对话 ────────────────────────────────
function loadConversation(convId) {
  currentConvId = convId;
  emptyState.classList.add('hidden');

  // 更新标题
  const list = Store.ConvList.get();
  const conv = list.find(c => c.id === convId);
  chatHeader.textContent = conv ? conv.title : '新对话';

  // 渲染消息列表
  messagesContainer.innerHTML = '';
  const messages = Store.ConvMessages.get(convId);
  messages.forEach(msg => renderMessage(msg, convId, false));

  // 如果有正在流式的消息（切换回来），不做特殊处理，状态已在 streamingMap 中
  scrollToBottom();
  updateInputState();
}

// ─── 渲染单条消息 ─────────────────────────────
function renderMessage(msg, convId, scrollDown = true) {
  const isUser = msg.role === 'user';
  const row = document.createElement('div');
  row.className = `message-row ${isUser ? 'user' : 'ai'}`;
  row.dataset.msgId = msg.id;

  if (isUser) {
    row.innerHTML = buildUserBubble(msg);
  } else {
    row.innerHTML = buildAiBubble(msg, convId);
  }

  messagesContainer.appendChild(row);
  if (scrollDown) scrollToBottom();
  return row;
}

// ─── 构建用户气泡 HTML ───────────────────────
function buildUserBubble(msg) {
  return `
    <div class="message-bubble-wrapper">
      <div class="message-bubble user">${esc(msg.content)}</div>
      <div class="message-time">${Store.formatTime(msg.ts)}</div>
    </div>
    <div class="message-avatar user">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </div>
  `;
}

// ─── 构建 AI 气泡 HTML ───────────────────────
function buildAiBubble(msg, convId) {
  const hasThinking = msg.thinking && msg.thinking.trim();
  const hasAnswer   = msg.answer && msg.answer.trim();
  const isStreaming  = msg.status === 'streaming';
  const isInterrupted = msg.status === 'interrupted';
  const isError      = msg.status === 'error';

  const thinkingHtml = hasThinking
    ? buildThinkingBlock(msg.thinking, isStreaming)
    : (isStreaming ? buildThinkingBlock('', true) : '');

  let answerHtml = '';
  if (isError) {
    answerHtml = `<div class="message-error">${esc(msg.answer || '对话出错，请重试')}</div>`;
  } else if (hasAnswer) {
    answerHtml = `<div class="answer-content${isStreaming ? ' streaming-cursor' : ''}">${Renderer.renderMarkdown(msg.answer)}</div>`;
  } else if (isStreaming) {
    answerHtml = `<div class="answer-content streaming-cursor"></div>`;
  }

  const actionsHtml = isInterrupted
    ? buildInterruptedActions(msg, convId)
    : '';

  return `
    <div class="message-avatar ai">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
    </div>
    <div class="message-bubble-wrapper">
      <div class="message-bubble ai" data-msg-id="${msg.id}">
        ${thinkingHtml}
        ${answerHtml}
      </div>
      <div class="message-time">${Store.formatTime(msg.ts)}</div>
      ${actionsHtml}
    </div>
  `;
}

// ─── 构建思考块 HTML ─────────────────────────
function buildThinkingBlock(content, isStreaming) {
  return `
    <details class="thinking-block${isStreaming ? ' streaming' : ''}"${isStreaming ? ' open' : ''}>
      <summary>
        <svg class="thinking-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span class="thinking-label">思考过程</span>
      </summary>
      <div class="thinking-content${isStreaming ? ' streaming-cursor' : ''}">${esc(content)}</div>
    </details>
  `;
}

// ─── 构建中断恢复操作区 HTML ─────────────────
function buildInterruptedActions(msg, convId) {
  return `
    <div class="message-actions">
      <span class="interrupted-hint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        输出中断
      </span>
      <button class="btn-refetch"
        onclick="Chat.refetchMessage('${convId}', '${msg.id}', '${msg.chat_id}', '${msg.conversation_id}', this)"
        title="从 Coze 服务器拉取完整回复">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        拉取完整回复
      </button>
    </div>
  `;
}

// ─── 发送消息 ────────────────────────────────
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) {
    // 抖动提示
    document.querySelector('.input-wrapper').classList.add('shake');
    setTimeout(() => document.querySelector('.input-wrapper').classList.remove('shake'), 300);
    return;
  }

  const cfg = Store.Config.get();
  if (!cfg.apiKey || !cfg.botId) {
    Toast.show('请先在左下角配置 API Key 和 Bot ID', 'error');
    return;
  }

  // 如果没有当前对话，自动新建
  if (!currentConvId) {
    Sidebar.newConversation();
    return; // newConversation 会触发 selectConv → loadConversation，再等用户操作
  }

  const convId = currentConvId;
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // ① 添加用户消息
  const userMsg = {
    id:      Store.genId(),
    role:    'user',
    content: text,
    ts:      Date.now(),
    status:  'completed',
  };
  Store.ConvMessages.addMessage(convId, userMsg);
  renderMessage(userMsg, convId);

  // 更新对话标题（首条消息）
  const messages = Store.ConvMessages.get(convId);
  if (messages.length === 1) {
    Sidebar.updateConvTitle(convId, text);
  }

  // ② 添加 AI 占位消息
  const aiMsgId = Store.genId();
  const aiMsg = {
    id:              aiMsgId,
    role:            'assistant',
    thinking:        '',
    answer:          '',
    status:          'streaming',
    chat_id:         '',
    conversation_id: '',
    ts:              Date.now(),
  };
  Store.ConvMessages.addMessage(convId, aiMsg);
  renderMessage(aiMsg, convId);

  // ③ 初始化并发状态
  const abortController = new AbortController();
  streamingMap.set(convId, {
    thinkingBuffer:  '',
    answerBuffer:    '',
    status:          'streaming',
    chat_id:         '',
    conversation_id: '',
    abortController,
    msgId:           aiMsgId,
  });

  updateInputState();
  Sidebar.refreshStreamStatus();

  // ④ 构造历史消息（不包含当前这条 AI 空消息）
  const historyMessages = messages
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.status === 'completed' && m.answer))
    .map(m => ({
      role:    m.role,
      content: m.role === 'user' ? m.content : m.answer,
    }));

  // ⑤ 获取已有的 conversation_id（复用 Coze 会话上下文）
  const existingConvId = getCozeConversationId(convId);

  try {
    const response = await Api.fetchChatStream(
      {
        api_key:         cfg.apiKey,
        bot_id:          cfg.botId,
        base_url:        cfg.baseUrl,
        conversation_id: existingConvId,
        messages:        historyMessages,
      },
      abortController.signal
    );

    await Stream.readStream(response, {
      onMeta: (meta) => handleMeta(convId, aiMsgId, meta),
      onThinking: (chunk) => handleThinking(convId, aiMsgId, chunk),
      onAnswer:   (chunk) => handleAnswer(convId, aiMsgId, chunk),
      onDone:     () => handleDone(convId, aiMsgId),
      onError:    (msg) => handleError(convId, aiMsgId, msg),
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      handleInterrupted(convId, aiMsgId);
    } else {
      handleError(convId, aiMsgId, err.message);
    }
  }
}

// ─── 获取已有的 Coze conversation_id ─────────
function getCozeConversationId(convId) {
  const messages = Store.ConvMessages.get(convId);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].conversation_id) return messages[i].conversation_id;
  }
  return '';
}

// ─── 流式回调处理 ────────────────────────────
function handleMeta(convId, msgId, meta) {
  const state = streamingMap.get(convId);
  if (!state || state.msgId !== msgId) return;
  state.chat_id = meta.chat_id;
  state.conversation_id = meta.conversation_id;
  // 写入 localStorage，刷新后可用于拉取
  Store.ConvMessages.updateMessage(convId, msgId, {
    chat_id:         meta.chat_id,
    conversation_id: meta.conversation_id,
  });
}

function handleThinking(convId, msgId, chunk) {
  const state = streamingMap.get(convId);
  if (!state || state.msgId !== msgId) return;
  state.thinkingBuffer += chunk;
  updateAiBubble(convId, msgId, state, true);
}

function handleAnswer(convId, msgId, chunk) {
  const state = streamingMap.get(convId);
  if (!state || state.msgId !== msgId) return;
  state.answerBuffer += chunk;
  updateAiBubble(convId, msgId, state, true);
}

function handleDone(convId, msgId) {
  const state = streamingMap.get(convId);
  if (!state || state.msgId !== msgId) return;

  // 持久化完整内容
  Store.ConvMessages.updateMessage(convId, msgId, {
    thinking: state.thinkingBuffer,
    answer:   state.answerBuffer,
    status:   'completed',
  });
  Store.ConvList.updateTimestamp(convId);

  streamingMap.delete(convId);

  // 最终渲染（关闭流式光标，折叠思考块）
  finalizeAiBubble(convId, msgId, state);
  updateInputState();
  Sidebar.refreshStreamStatus();
}

function handleError(convId, msgId, errMsg) {
  const state = streamingMap.get(convId);
  if (!state || state.msgId !== msgId) return;

  Store.ConvMessages.updateMessage(convId, msgId, {
    thinking: state.thinkingBuffer,
    answer:   errMsg,
    status:   'error',
  });

  streamingMap.delete(convId);
  finalizeAiBubble(convId, msgId, state, true, errMsg);
  updateInputState();
  Sidebar.refreshStreamStatus();
  Toast.show(errMsg, 'error');
}

function handleInterrupted(convId, msgId) {
  const state = streamingMap.get(convId);
  if (!state || state.msgId !== msgId) return;

  Store.ConvMessages.updateMessage(convId, msgId, {
    thinking:        state.thinkingBuffer,
    answer:          state.answerBuffer,
    status:          'interrupted',
    chat_id:         state.chat_id,
    conversation_id: state.conversation_id,
  });

  streamingMap.delete(convId);
  finalizeAiBubble(convId, msgId, state, false, null, true);
  updateInputState();
  Sidebar.refreshStreamStatus();
}

// ─── 更新流式气泡（增量渲染） ─────────────────
function updateAiBubble(convId, msgId, state, isStreaming) {
  if (convId !== currentConvId) return; // 不在视口，不操作 DOM

  const row = messagesContainer.querySelector(`[data-msg-id="${msgId}"]`);
  if (!row) return;

  const bubble = row.closest('.message-bubble');
  if (!bubble) return;

  // 更新思考块
  if (state.thinkingBuffer) {
    let thinkingBlock = bubble.querySelector('.thinking-block');
    if (!thinkingBlock) {
      const div = document.createElement('div');
      div.innerHTML = buildThinkingBlock(state.thinkingBuffer, true);
      thinkingBlock = div.firstElementChild;
      bubble.insertBefore(thinkingBlock, bubble.firstChild);
    } else {
      const contentEl = thinkingBlock.querySelector('.thinking-content');
      if (contentEl) {
        contentEl.textContent = state.thinkingBuffer;
        // 自动滚动思考内容到底部
        contentEl.scrollTop = contentEl.scrollHeight;
      }
      thinkingBlock.open = true;
    }
  }

  // 更新正文
  let answerEl = bubble.querySelector('.answer-content');
  if (!answerEl) {
    answerEl = document.createElement('div');
    answerEl.className = 'answer-content streaming-cursor';
    bubble.appendChild(answerEl);
  }

  if (state.answerBuffer) {
    answerEl.innerHTML = Renderer.renderMarkdown(state.answerBuffer);
    answerEl.classList.add('streaming-cursor');
  }

  scrollToBottom();
}

// ─── 最终化气泡（流结束后） ───────────────────
function finalizeAiBubble(convId, msgId, state, isError = false, errMsg = null, isInterrupted = false) {
  if (convId !== currentConvId) return;

  const row = messagesContainer.querySelector(`[data-msg-id="${msgId}"]`);
  if (!row) return;

  const bubble = row.closest('.message-bubble');
  if (!bubble) return;

  // 移除流式光标
  bubble.querySelectorAll('.streaming-cursor').forEach(el => {
    el.classList.remove('streaming-cursor');
  });

  // 折叠思考块，恢复交互
  const thinkingBlock = bubble.querySelector('.thinking-block');
  if (thinkingBlock) {
    thinkingBlock.classList.remove('streaming');
    thinkingBlock.open = false; // 默认折叠
  }

  // 错误状态替换正文
  if (isError && errMsg) {
    let answerEl = bubble.querySelector('.answer-content');
    if (!answerEl) {
      answerEl = document.createElement('div');
      bubble.appendChild(answerEl);
    }
    answerEl.className = 'message-error';
    answerEl.textContent = errMsg;
  }

  // 中断状态：在气泡外添加操作栏
  if (isInterrupted) {
    const msg = Store.ConvMessages.get(convId).find(m => m.id === msgId);
    if (msg) {
      const actionsDiv = document.createElement('div');
      actionsDiv.innerHTML = buildInterruptedActions(msg, convId);
      const bubbleWrapper = row.querySelector('.message-bubble-wrapper');
      if (bubbleWrapper) bubbleWrapper.appendChild(actionsDiv.firstElementChild);
    }
  }
}

// ─── 拉取完整回复（中断恢复） ─────────────────
async function refetchMessage(convId, msgId, chatId, cozeConvId, btn) {
  if (!chatId || !cozeConvId) {
    Toast.show('缺少 chat_id 或 conversation_id，无法拉取', 'error');
    return;
  }

  const cfg = Store.Config.get();
  btn.disabled = true;
  btn.classList.add('loading');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M23 4v6h-6M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
    获取中…
  `;

  try {
    const result = await Api.fetchMessages({
      api_key:         cfg.apiKey,
      bot_id:          cfg.botId,
      base_url:        cfg.baseUrl,
      chat_id:         chatId,
      conversation_id: cozeConvId,
    });

    if (result.error && !result.answer) {
      throw new Error(result.error);
    }

    // 持久化
    Store.ConvMessages.updateMessage(convId, msgId, {
      thinking: result.thinking || '',
      answer:   result.answer   || '',
      status:   'completed',
    });

    // 重新渲染该消息
    const msg = Store.ConvMessages.get(convId).find(m => m.id === msgId);
    if (msg && convId === currentConvId) {
      const row = messagesContainer.querySelector(`[data-msg-id="${msgId}"]`);
      if (row) {
        const msgRow = row.closest('.message-row');
        if (msgRow) {
          // 重新构建这一行
          const tempDiv = document.createElement('div');
          tempDiv.className = msgRow.className;
          tempDiv.dataset.msgId = msgId;
          tempDiv.innerHTML = buildAiBubble(msg, convId);
          msgRow.replaceWith(tempDiv);
        }
      }
    }

    Toast.show('已补全回复', 'success');
  } catch (err) {
    Toast.show(err.message || '拉取失败，请重试', 'error');
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      拉取完整回复
    `;
  }
}

// ─── 停止当前对话流式 ─────────────────────────
function stopCurrentStream() {
  if (!currentConvId) return;
  const state = streamingMap.get(currentConvId);
  if (state) {
    state.abortController.abort();
  }
}

// ─── 工具：滚动到底部 ────────────────────────
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ─── 更新输入区域状态 ────────────────────────
function updateInputState() {
  const convStreaming = currentConvId && streamingMap.has(currentConvId);
  const anyConvSelected = !!currentConvId;

  chatInput.disabled = !anyConvSelected;
  chatInput.placeholder = anyConvSelected ? '输入消息…' : '请先选择或新建对话';

  if (convStreaming) {
    btnSend.classList.add('hidden');
    btnStop.classList.remove('hidden');
    inputHint.textContent = '正在生成…';
  } else {
    btnSend.classList.remove('hidden');
    btnStop.classList.add('hidden');
    inputHint.textContent = 'Enter 发送 · Shift+Enter 换行';
  }
}

// ─── 查询并发状态 ────────────────────────────
function isStreaming(convId) {
  return streamingMap.has(convId);
}

function streamingCount() {
  return streamingMap.size;
}

// ─── 事件绑定 ────────────────────────────────
btnSend.addEventListener('click', sendMessage);
btnStop.addEventListener('click', stopCurrentStream);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// textarea 自动扩展高度
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  const maxH = parseFloat(getComputedStyle(chatInput).lineHeight) * 6;
  chatInput.style.height = Math.min(chatInput.scrollHeight, maxH) + 'px';
});

window.Chat = {
  showEmpty,
  loadConversation,
  sendMessage,
  stopCurrentStream,
  refetchMessage,
  isStreaming,
  streamingCount,
};
