import { renderHeader, confirmDialog } from '../common.js';
import { saveImage, getImageUrl, deleteImage, listImagesByKind } from '../images.js';
import { getSetting, setSetting } from '../db.js';

renderHeader('pages/backgrounds.html');

const bgThumbs = document.getElementById('bg-thumbs');
const bgFileInput = document.getElementById('bg-file-input');
const bgModeSelect = document.getElementById('bg-mode');

bgModeSelect.value = await getSetting('commonBackgroundMode', 'sequential');
bgModeSelect.addEventListener('change', () => {
  setSetting('commonBackgroundMode', bgModeSelect.value);
});

async function render() {
  const images = await listImagesByKind('common');
  const urls = await Promise.all(images.map((img) => getImageUrl(img.id)));
  bgThumbs.innerHTML = images.map((img, i) => `
    <div class="thumb" data-id="${img.id}">
      <img src="${urls[i]}" alt="背景画像">
      <button class="remove" data-action="remove" data-id="${img.id}">×</button>
    </div>
  `).join('') || '<span class="hint">未登録</span>';
}

bgFileInput.addEventListener('change', async () => {
  const files = Array.from(bgFileInput.files || []);
  for (const file of files) {
    await saveImage(file, file.name, 'common');
  }
  bgFileInput.value = '';
  await render();
});

bgThumbs.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="remove"]');
  if (!btn) return;
  if (!confirmDialog('この共通背景画像を削除しますか？')) return;
  await deleteImage(btn.dataset.id);
  await render();
});

render();
