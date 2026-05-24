/**
 * store.js — localStorage 读写封装
 * 所有持久化数据通过此模块统一管理
 */

const KEYS = {
  CONFIG:        'coze_config',
  CONV_LIST:     'coze_conversation_list',
  CONV_PREFIX:   'coze_conv_',
};

// ─── 工具函数 ────────────────────────────────
function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    // 存储前检查可用空间（粗略估算）
    const str = JSON.stringify(value);
    const used = JSON.stringify(localStorage).length;
    if (used + str.length > 4.5 * 1024 * 1024) { // 4.5MB 警戒线
      console.warn('[store] localStorage 接近上限，建议清理旧对话');
      window.dispatchEvent(new CustomEvent('storage-near-limit'));
    }
    localStorage.setItem(key, str);
    return true;
  } catch (e) {
    console.error('[store] 写入失败:', e);
    return false;
  }
}

// ─── 配置 ────────────────────────────────────
const Config = {
  get() {
    return safeGet(KEYS.CONFIG) || {
      apiKey:  '',
      botId:   '',
      baseUrl: 'https://api.coze.cn',
    };
  },
  save(config) {
    return safeSet(KEYS.CONFIG, config);
  },
};

// ─── 对话列表 ─────────────────────────────────
const ConvList = {
  get() {
    return safeGet(KEYS.CONV_LIST) || [];
  },

  save(list) {
    return safeSet(KEYS.CONV_LIST, list);
  },

  add(conv) {
    const list = this.get();
    list.unshift(conv); // 最新的在最前面
    this.save(list);
  },

  remove(convId) {
    const list = this.get().filter(c => c.id !== convId);
    this.save(list);
    localStorage.removeItem(KEYS.CONV_PREFIX + convId);
  },

  updateTitle(convId, title) {
    const list = this.get();
    const item = list.find(c => c.id === convId);
    if (item) {
      item.title = title;
      item.updatedAt = Date.now();
      this.save(list);
    }
  },

  updateTimestamp(convId) {
    const list = this.get();
    const item = list.find(c => c.id === convId);
    if (item) {
      item.updatedAt = Date.now();
      this.save(list);
    }
  },
};

// ─── 单个对话消息 ─────────────────────────────
const ConvMessages = {
  get(convId) {
    const data = safeGet(KEYS.CONV_PREFIX + convId);
    return data ? data.messages || [] : [];
  },

  save(convId, messages) {
    return safeSet(KEYS.CONV_PREFIX + convId, { messages });
  },

  addMessage(convId, message) {
    const messages = this.get(convId);
    messages.push(message);
    this.save(convId, messages);
  },

  updateMessage(convId, msgId, patch) {
    const messages = this.get(convId);
    const msg = messages.find(m => m.id === msgId);
    if (msg) {
      Object.assign(msg, patch);
      this.save(convId, messages);
    }
  },

  // 检查是否有未完成的流式消息
  getInterruptedMessages(convId) {
    return this.get(convId).filter(m => m.status === 'interrupted');
  },
};

// ─── 生成唯一 ID ──────────────────────────────
function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── 格式化时间 ──────────────────────────────
function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

window.Store = { Config, ConvList, ConvMessages, genId, formatTime };
