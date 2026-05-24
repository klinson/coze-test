/**
 * sidebar.js — 左侧边栏：对话列表 + 配置面板
 */

// ─── DOM 引用 ────────────────────────────────
const convListEl      = document.getElementById('conv-list');
const btnNewChat      = document.getElementById('btn-new-chat');
const configBody      = document.getElementById('config-body');
const configToggle    = document.getElementById('config-toggle');
const configToggleIcon = document.getElementById('config-toggle-icon');
const inputApiKey     = document.getElementById('input-api-key');
const inputBotId      = document.getElementById('input-bot-id');
const selectBaseUrl   = document.getElementById('select-base-url');
const btnSaveConfig   = document.getElementById('btn-save-config');
const btnToggleKey    = document.getElementById('btn-toggle-key');

// ─── 状态 ─────────────────────────────────────
let activeConvId = null;

// ─── 渲染对话列表 ─────────────────────────────
function renderConvList() {
  const list = Store.ConvList.get();
  convListEl.innerHTML = '';

  if (list.length === 0) {
    convListEl.innerHTML = `<div class="conv-empty">暂无历史对话<br>点击上方按钮新建</div>`;
    return;
  }

  list.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'conv-item' + (conv.id === activeConvId ? ' active' : '');
    item.dataset.id = conv.id;

    const isStreaming = Chat.isStreaming(conv.id);

    item.innerHTML = `
      <svg class="conv-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <div class="conv-item-body">
        <div class="conv-item-title" title="${escHtml(conv.title)}">${escHtml(conv.title)}</div>
        <div class="conv-item-time">${Store.formatTime(conv.updatedAt || conv.createdAt)}</div>
      </div>
      ${isStreaming ? '<div class="conv-item-badge"></div>' : ''}
      <button class="conv-item-delete" data-id="${conv.id}" title="删除对话" onclick="Sidebar.deleteConv(event, '${conv.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.conv-item-delete')) return;
      Sidebar.selectConv(conv.id);
    });

    convListEl.appendChild(item);
  });
}

// ─── 选中对话 ────────────────────────────────
function selectConv(convId) {
  activeConvId = convId;
  renderConvList();
  Chat.loadConversation(convId);
}

// ─── 删除对话 ────────────────────────────────
function deleteConv(e, convId) {
  e.stopPropagation();

  // 正在流式中的对话不允许删除
  if (Chat.isStreaming(convId)) {
    Toast.show('请先停止流式输出再删除', 'error');
    return;
  }

  Store.ConvList.remove(convId);

  if (activeConvId === convId) {
    // 删除当前对话，切换到最新的
    const list = Store.ConvList.get();
    if (list.length > 0) {
      selectConv(list[0].id);
    } else {
      activeConvId = null;
      Chat.showEmpty();
    }
  }

  renderConvList();
}

// ─── 新建对话 ────────────────────────────────
function newConversation() {
  const convId = Store.genId();
  const conv = {
    id:        convId,
    title:     '新对话',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  Store.ConvList.add(conv);
  Store.ConvMessages.save(convId, []);
  selectConv(convId);
}

// ─── 配置面板折叠 ────────────────────────────
function toggleConfig() {
  const isOpen = configBody.classList.contains('open');
  configBody.classList.toggle('open', !isOpen);
  configToggleIcon.classList.toggle('open', !isOpen);
}

// ─── 加载配置到表单 ──────────────────────────
function loadConfig() {
  const cfg = Store.Config.get();
  inputApiKey.value  = cfg.apiKey  || '';
  inputBotId.value   = cfg.botId   || '';
  selectBaseUrl.value = cfg.baseUrl || 'https://api.coze.cn';
}

// ─── 保存配置 ────────────────────────────────
function saveConfig() {
  const cfg = {
    apiKey:  inputApiKey.value.trim(),
    botId:   inputBotId.value.trim(),
    baseUrl: selectBaseUrl.value,
  };
  Store.Config.save(cfg);

  // 视觉反馈
  btnSaveConfig.classList.add('saved');
  btnSaveConfig.textContent = '✓ 已保存';
  setTimeout(() => {
    btnSaveConfig.classList.remove('saved');
    btnSaveConfig.textContent = '保存配置';
  }, 1800);
}

// ─── API Key 明文切换 ─────────────────────────
function toggleKeyVisibility() {
  const isPassword = inputApiKey.type === 'password';
  inputApiKey.type = isPassword ? 'text' : 'password';
  btnToggleKey.innerHTML = isPassword ? EYE_OPEN_SVG : EYE_CLOSED_SVG;
}

// ─── 更新对话标题（首条消息截取） ────────────
function updateConvTitle(convId, firstUserMsg) {
  const title = firstUserMsg.slice(0, 20) + (firstUserMsg.length > 20 ? '…' : '');
  Store.ConvList.updateTitle(convId, title);
  renderConvList();
}

// ─── 标记对话流式状态（刷新列表） ────────────
function refreshStreamStatus() {
  renderConvList();
  updateStreamIndicator();
}

// ─── 并发流式指示器 ──────────────────────────
const streamIndicator = document.getElementById('stream-indicator');
const streamIndicatorCount = document.getElementById('stream-count');

function updateStreamIndicator() {
  const count = Chat.streamingCount();
  if (count > 0) {
    streamIndicator.classList.add('visible');
    streamIndicatorCount.textContent = count;
  } else {
    streamIndicator.classList.remove('visible');
  }
}

// ─── SVG 图标 ────────────────────────────────
const EYE_OPEN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>`;

const EYE_CLOSED_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
  <line x1="1" y1="1" x2="23" y2="23"/>
</svg>`;

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── 事件绑定 ────────────────────────────────
btnNewChat.addEventListener('click', newConversation);
configToggle.addEventListener('click', toggleConfig);
btnSaveConfig.addEventListener('click', saveConfig);
btnToggleKey.addEventListener('click', toggleKeyVisibility);

// storage 接近上限提示
window.addEventListener('storage-near-limit', () => {
  Toast.show('存储空间接近上限，建议清理旧对话', 'error');
});

// ─── 初始化 ──────────────────────────────────
function init() {
  loadConfig();
  const list = Store.ConvList.get();
  if (list.length > 0) {
    selectConv(list[0].id);
  } else {
    Chat.showEmpty();
  }
}

window.Sidebar = {
  renderConvList,
  selectConv,
  deleteConv,
  newConversation,
  updateConvTitle,
  refreshStreamStatus,
  updateStreamIndicator,
  init,
  get activeConvId() { return activeConvId; },
};
