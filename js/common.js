// 全ページ共通のヘッダー描画・トースト表示
const NAV_ITEMS = [
  { href: 'index.html', label: '曲一覧' },
  { href: 'pages/backgrounds.html', label: '共通背景' },
  { href: 'pages/setlist.html', label: 'セットリスト' },
  { href: 'pages/stage.html', label: '本番モード' },
  { href: 'pages/settings.html', label: '設定・ペダル' },
  { href: 'pages/backup.html', label: 'バックアップ' },
];

export function renderHeader(activeHref) {
  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <h1>ライブコード歌詞アプリ</h1>
    <nav class="app-nav"></nav>
  `;
  const nav = header.querySelector('nav');
  for (const item of NAV_ITEMS) {
    const a = document.createElement('a');
    a.href = resolveHref(item.href);
    a.textContent = item.label;
    if (item.href === activeHref) a.classList.add('active');
    nav.appendChild(a);
  }
  document.body.prepend(header);
}

function resolveHref(href) {
  // pages/配下からindex.htmlや他pages/へ移動する際の相対パス補正
  const inPages = location.pathname.includes('/pages/');
  if (!inPages) return href;
  if (href === 'index.html') return '../index.html';
  if (href.startsWith('pages/')) return href.replace('pages/', '');
  return href;
}

function resolveRootPath(path) {
  const inPages = location.pathname.includes('/pages/');
  return inPages ? `../${path}` : path;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(resolveRootPath('sw.js')).catch(() => {});
  });
}

export function toast(message, ms = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function confirmDialog(message) {
  return window.confirm(message);
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
