/**
 * renderer.js — Markdown 渲染 + 代码块高亮 + 复制按钮
 * 依赖：marked.js, DOMPurify, highlight.js（均通过 CDN 引入）
 */

// 等待外部库加载完成
function waitForLibs() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.marked && window.DOMPurify && window.hljs) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

let markedReady = false;

async function initRenderer() {
  if (markedReady) return;
  await waitForLibs();

  // 自定义 marked renderer，为代码块加头部
  const renderer = new marked.Renderer();

  renderer.code = function (code, lang) {
    // marked v5+ 可能传入对象
    let codeText = typeof code === 'object' ? code.text : code;
    let language = typeof code === 'object' ? code.lang : lang;

    const validLang = language && hljs.getLanguage(language) ? language : 'plaintext';
    let highlighted;
    try {
      highlighted = hljs.highlight(codeText || '', { language: validLang }).value;
    } catch {
      highlighted = escapeHtml(codeText || '');
    }

    const langLabel = validLang === 'plaintext' ? '' : validLang;

    return `<div class="code-block-wrapper">
  <div class="code-block-header">
    <span class="code-block-lang">${langLabel}</span>
    <button class="code-copy-btn" onclick="Renderer.copyCode(this)">复制</button>
  </div>
  <pre><code class="hljs language-${validLang}">${highlighted}</code></pre>
</div>`;
  };

  marked.setOptions({
    renderer,
    breaks: true,       // 单个换行转为 <br>
    gfm: true,          // GitHub 风格 Markdown
  });

  markedReady = true;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 将 Markdown 文本渲染为安全 HTML 字符串
 */
function renderMarkdown(text) {
  if (!text) return '';
  if (!markedReady) {
    // 还未初始化，返回纯文本（保底）
    return `<p>${escapeHtml(text)}</p>`;
  }
  try {
    const raw = marked.parse(text);
    return DOMPurify.sanitize(raw, {
      ADD_TAGS: ['button'],
      ADD_ATTR: ['onclick', 'class'],
    });
  } catch {
    return `<p>${escapeHtml(text)}</p>`;
  }
}

/**
 * 复制代码块内容
 */
function copyCode(btn) {
  const pre = btn.closest('.code-block-wrapper').querySelector('pre code');
  if (!pre) return;
  const text = pre.innerText || pre.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = '已复制';
    btn.style.color = 'var(--color-success)';
    btn.style.borderColor = 'var(--color-success)';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  }).catch(() => {
    btn.textContent = '失败';
    setTimeout(() => { btn.textContent = '复制'; }, 1500);
  });
}

// 初始化（异步，页面加载后自动执行）
initRenderer();

window.Renderer = { renderMarkdown, copyCode, initRenderer };
