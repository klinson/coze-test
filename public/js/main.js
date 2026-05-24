/**
 * main.js — 应用入口 + Toast 提示组件
 */

// ─── Toast 提示 ───────────────────────────────
const toastContainer = document.getElementById('toast-container');

const Toast = {
  show(message, type = 'default', duration = 2500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  },
};

window.Toast = Toast;

// ─── 应用初始化 ───────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 等待 Renderer 初始化（marked + DOMPurify + hljs）
  await Renderer.initRenderer();

  // 初始化侧边栏（加载配置 + 对话列表）
  Sidebar.init();

  // 初始化输入区状态
  Chat.showEmpty();

  // 页面加载后检查是否有中断的流式对话
  // （已在 loadConversation 中通过 renderMessage 渲染恢复按钮）
});
