/**
 * main.js — 应用入口 + Toast + 移动端侧边栏控制
 */

// ─── Toast ────────────────────────────────────
const Toast = {
  show(message, type = 'default', duration = 2500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  },
};
window.Toast = Toast;

// ─── 移动端侧边栏控制 ─────────────────────────
const MobileSidebar = {
  sidebar:  null,
  overlay:  null,
  btnMenu:  null,
  btnClose: null,

  init() {
    this.sidebar  = document.getElementById('sidebar');
    this.overlay  = document.getElementById('sidebar-overlay');
    this.btnMenu  = document.getElementById('btn-menu');
    this.btnClose = document.getElementById('btn-sidebar-close');

    if (this.btnMenu)  this.btnMenu.addEventListener('click',  () => this.open());
    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.overlay)  this.overlay.addEventListener('click',  () => this.close());

    // 滑动关闭（左滑 > 60px 时关闭）
    let startX = 0;
    if (this.sidebar) {
      this.sidebar.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
      }, { passive: true });

      this.sidebar.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (dx < -60) this.close();
      }, { passive: true });
    }

    // 路由变化 / 选中对话后自动关闭侧边栏（移动端）
    window.addEventListener('conv-selected', () => {
      if (window.innerWidth <= 768) this.close();
    });
  },

  open() {
    if (!this.sidebar || !this.overlay) return;
    this.sidebar.classList.add('open');
    this.overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  },

  close() {
    if (!this.sidebar || !this.overlay) return;
    this.sidebar.classList.remove('open');
    this.overlay.classList.remove('visible');
    document.body.style.overflow = '';
  },

  // 判断当前是否为移动端
  isMobile() {
    return window.innerWidth <= 768;
  },
};

window.MobileSidebar = MobileSidebar;

// ─── 应用初始化 ───────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 初始化 DOM 引用和事件绑定
  Chat.initChat();
  Sidebar.initSidebar();
  MobileSidebar.init();

  // 2. 等待渲染库就绪
  await Renderer.initRenderer();

  // 3. 加载对话列表和配置
  Sidebar.init();

  // 4. 移动端首次加载：若无对话自动打开侧边栏引导用户
  if (MobileSidebar.isMobile()) {
    const list = Store.ConvList.get();
    if (list.length === 0) {
      setTimeout(() => MobileSidebar.open(), 300);
    }
  }
});
