import { renderHeader, toast, confirmDialog, escapeHtml } from '../common.js';
import { getAll, put, remove, uuid, getSetting, setSetting } from '../db.js';
import { listSongs } from '../songs.js';

renderHeader('pages/setlist.html');

const selectEl = document.getElementById('setlist-select');
const detailEl = document.getElementById('setlist-detail');
const nameInput = document.getElementById('setlist-name');
const songsPanelEl = document.getElementById('setlist-songs-panel');
const songListEl = document.getElementById('setlist-song-list');
const addPanelEl = document.getElementById('add-song-panel');
const allSongListEl = document.getElementById('all-song-list');
const currentIndicator = document.getElementById('current-indicator');

let setlists = [];
let songsById = {};
let currentId = null; // 選択中（画面表示中）のセットリストID
let activeSetlistId = null; // 本番で使うセットリストID

async function loadAll() {
  const [sl, songs] = await Promise.all([getAll('setlists'), listSongs()]);
  setlists = sl.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  songsById = Object.fromEntries(songs.map((s) => [s.id, s]));
  activeSetlistId = await getSetting('currentSetlistId', null);
}

function renderSelect() {
  selectEl.innerHTML = setlists.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if (setlists.length === 0) {
    detailEl.hidden = true;
    songsPanelEl.hidden = true;
    addPanelEl.hidden = true;
    return;
  }
  if (!currentId || !setlists.find((s) => s.id === currentId)) {
    currentId = setlists[0].id;
  }
  selectEl.value = currentId;
  detailEl.hidden = false;
  songsPanelEl.hidden = false;
  addPanelEl.hidden = false;
}

function getCurrent() {
  return setlists.find((s) => s.id === currentId);
}

function renderDetail() {
  const setlist = getCurrent();
  if (!setlist) return;
  nameInput.value = setlist.name;
  currentIndicator.textContent = activeSetlistId === setlist.id ? '★ 現在本番用に設定されています' : '';

  songListEl.innerHTML = setlist.songIds.length
    ? setlist.songIds.map((songId, i) => {
        const song = songsById[songId];
        const title = song ? escapeHtml(song.title) : '（削除済みの曲）';
        return `
          <div class="list-item" data-index="${i}">
            <div class="title">${i + 1}. ${title}</div>
            <div class="row">
              <button data-action="up" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button data-action="down" ${i === setlist.songIds.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="danger" data-action="remove">削除</button>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty">曲が追加されていません。下から追加してください。</div>';

  const addedSet = new Set(setlist.songIds);
  const allSongs = Object.values(songsById);
  allSongListEl.innerHTML = allSongs.length
    ? allSongs.map((s) => `
        <div class="list-item">
          <div class="title">${escapeHtml(s.title)}</div>
          <button data-action="add" data-id="${s.id}" ${addedSet.has(s.id) ? 'disabled' : ''}>${addedSet.has(s.id) ? '追加済み' : '追加'}</button>
        </div>
      `).join('')
    : '<div class="empty">先に曲一覧から曲を登録してください。</div>';
}

async function saveCurrent() {
  const setlist = getCurrent();
  if (!setlist) return;
  await put('setlists', setlist);
}

selectEl.addEventListener('change', () => {
  currentId = selectEl.value;
  renderDetail();
});

document.getElementById('btn-new-setlist').addEventListener('click', async () => {
  const setlist = { id: uuid(), name: `セットリスト${setlists.length + 1}`, songIds: [], order: Date.now() };
  await put('setlists', setlist);
  setlists.push(setlist);
  currentId = setlist.id;
  renderSelect();
  renderDetail();
});

document.getElementById('btn-delete-setlist').addEventListener('click', async () => {
  const setlist = getCurrent();
  if (!setlist) return;
  if (!confirmDialog(`「${setlist.name}」を削除しますか？`)) return;
  await remove('setlists', setlist.id);
  setlists = setlists.filter((s) => s.id !== setlist.id);
  currentId = null;
  if (activeSetlistId === setlist.id) {
    activeSetlistId = null;
    await setSetting('currentSetlistId', null);
  }
  renderSelect();
  renderDetail();
});

document.getElementById('btn-set-current').addEventListener('click', async () => {
  const setlist = getCurrent();
  if (!setlist) return;
  activeSetlistId = setlist.id;
  await setSetting('currentSetlistId', setlist.id);
  renderDetail();
  toast('本番用セットリストに設定しました');
});

nameInput.addEventListener('input', async () => {
  const setlist = getCurrent();
  if (!setlist) return;
  setlist.name = nameInput.value;
  await saveCurrent();
  renderSelect();
  selectEl.value = currentId;
});

songListEl.addEventListener('click', async (e) => {
  const setlist = getCurrent();
  if (!setlist) return;
  const item = e.target.closest('.list-item');
  const action = e.target.dataset.action;
  if (!item || !action) return;
  const index = Number(item.dataset.index);
  if (action === 'up' && index > 0) {
    [setlist.songIds[index - 1], setlist.songIds[index]] = [setlist.songIds[index], setlist.songIds[index - 1]];
  } else if (action === 'down' && index < setlist.songIds.length - 1) {
    [setlist.songIds[index + 1], setlist.songIds[index]] = [setlist.songIds[index], setlist.songIds[index + 1]];
  } else if (action === 'remove') {
    setlist.songIds.splice(index, 1);
  }
  await saveCurrent();
  renderDetail();
});

allSongListEl.addEventListener('click', async (e) => {
  const setlist = getCurrent();
  if (!setlist) return;
  const btn = e.target.closest('button[data-action="add"]');
  if (!btn) return;
  setlist.songIds.push(btn.dataset.id);
  await saveCurrent();
  renderDetail();
});

await loadAll();
if (setlists.length > 0) currentId = setlists[0].id;
renderSelect();
renderDetail();
