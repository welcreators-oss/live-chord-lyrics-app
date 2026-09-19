import { renderHeader, toast, confirmDialog, escapeHtml } from '../common.js';
import { listSongs, newSong, saveSong, deleteSong } from '../songs.js';

renderHeader('index.html');

const listEl = document.getElementById('song-list');
const titleInput = document.getElementById('new-song-title');
const addBtn = document.getElementById('btn-add-song');

async function render() {
  const songs = await listSongs();
  if (songs.length === 0) {
    listEl.innerHTML = '<div class="empty">曲がまだ登録されていません。上のフォームから追加してください。</div>';
    return;
  }
  listEl.innerHTML = songs.map((s) => `
    <div class="list-item" data-id="${s.id}">
      <div>
        <div class="title">${escapeHtml(s.title)}</div>
        <div class="meta">ブロック数: ${s.blocks.length} / 背景画像: ${s.backgroundImageIds.length}枚</div>
      </div>
      <div class="row">
        <a class="btn" href="pages/song-edit.html?id=${s.id}">編集</a>
        <button class="danger" data-action="delete" data-id="${s.id}">削除</button>
      </div>
    </div>
  `).join('');
}

addBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  if (!title) { toast('曲名を入力してください'); return; }
  const song = newSong(title);
  await saveSong(song);
  titleInput.value = '';
  await render();
  location.href = `pages/song-edit.html?id=${song.id}`;
});

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="delete"]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!confirmDialog('この曲を削除しますか？この操作は取り消せません。')) return;
  await deleteSong(id);
  await render();
  toast('削除しました');
});

render();
