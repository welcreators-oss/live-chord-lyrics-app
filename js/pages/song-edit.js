import { renderHeader, toast, confirmDialog, escapeHtml } from '../common.js';
import { getSong, saveSong, newBlock, textToLyricLines } from '../songs.js';
import { saveImage, getImageUrl, deleteImage, listImagesByKind } from '../images.js';
import { recognizeImage } from '../ocr.js';
import { renderChordEditor } from '../chord-editor.js';
import { containsChordLine, parseChordSheetText } from '../chord-text-parser.js';

renderHeader(null);

const params = new URLSearchParams(location.search);
const songId = params.get('id');
if (!songId) {
  document.querySelector('main').innerHTML = '<div class="empty">曲IDが指定されていません。</div>';
  throw new Error('no song id');
}

let song = await getSong(songId);
if (!song) {
  document.querySelector('main').innerHTML = '<div class="empty">曲が見つかりませんでした。</div>';
  throw new Error('song not found');
}

const titleInput = document.getElementById('song-title');
const saveStatus = document.getElementById('save-status');
const bgThumbs = document.getElementById('bg-thumbs');
const bgFileInput = document.getElementById('bg-file-input');
const blockListEl = document.getElementById('block-list');

titleInput.value = song.title;

// デバウンスせず操作の都度即時保存する（IndexedDBのput自体は高速なため）。
// ブロック追加/削除等の操作直後にリロードされても保存漏れが起きないよう、
// 呼び出し順を保証するPromiseチェーンで直列化する。
let savePromise = Promise.resolve();
function scheduleSave() {
  saveStatus.textContent = '保存中...';
  savePromise = savePromise.then(() => saveSong(song)).then(() => {
    const now = new Date();
    saveStatus.textContent = `保存済み（${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}）`;
  });
  return savePromise;
}
function flushSave() {
  return scheduleSave();
}
window.addEventListener('pagehide', () => { flushSave(); });
document.getElementById('btn-save').addEventListener('click', flushSave);

// ヘッダーナビゲーションや戻るリンクのクリック時は、保存完了を待ってから遷移する
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  e.preventDefault();
  flushSave().then(() => { location.href = link.href; });
}, true);

titleInput.addEventListener('input', () => {
  song.title = titleInput.value;
  scheduleSave();
});

// --- 背景画像（曲専用） ---
async function renderBgThumbs() {
  const urls = await Promise.all(song.backgroundImageIds.map((id) => getImageUrl(id)));
  bgThumbs.innerHTML = song.backgroundImageIds.map((id, i) => `
    <div class="thumb" data-id="${id}">
      <img src="${urls[i]}" alt="背景画像">
      <button class="remove" data-action="remove-bg" data-id="${id}">×</button>
    </div>
  `).join('') || '<span class="hint">未設定</span>';
}

bgFileInput.addEventListener('change', async () => {
  const files = Array.from(bgFileInput.files || []);
  for (const file of files) {
    const id = await saveImage(file, file.name, 'song');
    song.backgroundImageIds.push(id);
  }
  bgFileInput.value = '';
  await renderBgThumbs();
  scheduleSave();
});

bgThumbs.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="remove-bg"]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!confirmDialog('この背景画像を削除しますか？')) return;
  song.backgroundImageIds = song.backgroundImageIds.filter((x) => x !== id);
  await deleteImage(id);
  await renderBgThumbs();
  scheduleSave();
});

// --- ブロック ---
function renderBlocks() {
  blockListEl.innerHTML = '';
  song.blocks.forEach((block, index) => {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.dataset.blockId = block.id;
    panel.innerHTML = `
      <div class="row" style="justify-content: space-between;">
        <strong>ブロック ${index + 1}</strong>
        <div class="row">
          <button data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button data-action="down" ${index === song.blocks.length - 1 ? 'disabled' : ''}>↓</button>
          <button data-action="duplicate">複製</button>
          <button class="danger" data-action="delete" ${song.blocks.length <= 1 ? 'disabled' : ''}>削除</button>
        </div>
      </div>

      <div class="field">
        <label>コード譜の写真またはPDFからOCR取り込み</label>
        <div class="row">
          <input type="file" accept="image/*,.pdf,application/pdf" data-role="ocr-file">
          <span class="hint" data-role="ocr-status"></span>
        </div>
        <p class="hint">PDFは1ページ目のみ読み込みます。</p>
      </div>

      <div class="field">
        <label>歌詞テキスト（1行ずつ改行）</label>
        <p class="hint">コード譜サイト等のテキストをそのまま貼り付けてもOKです。「Am7　　C」のようなコードだけの行を歌詞の上に置くと、反映時に自動でコードの位置まで配置されます（OCRより正確です）。</p>
        <textarea data-role="lyric-text" rows="4" placeholder="Am7      C&#10;やさしい光が&#10;F      G/B&#10;夜に　二人で歩いた道">${escapeHtml(block.lyricLines.join('\n'))}</textarea>
        <div class="row" style="margin-top:6px;">
          <button data-action="apply-lyrics">歌詞をプレビューに反映</button>
        </div>
      </div>

      <div class="field">
        <label>コード配置プレビュー（クリックで配置／チップをクリックで削除／ドラッグで位置調整）</label>
        <div class="chord-editor" data-role="chord-editor"></div>
      </div>
    `;
    blockListEl.appendChild(panel);

    const chordEditorEl = panel.querySelector('[data-role="chord-editor"]');
    renderChordEditor(chordEditorEl, block, () => scheduleSave());

    panel.querySelector('[data-action="up"]').addEventListener('click', () => moveBlock(index, -1));
    panel.querySelector('[data-action="down"]').addEventListener('click', () => moveBlock(index, 1));
    panel.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateBlock(index));
    panel.querySelector('[data-action="delete"]').addEventListener('click', () => removeBlock(index));

    panel.querySelector('[data-action="apply-lyrics"]').addEventListener('click', () => {
      const text = panel.querySelector('[data-role="lyric-text"]').value;
      if (containsChordLine(text)) {
        // コード行（例: "Am7  C"）が含まれる場合は、コード譜テキストとして
        // 自動的にコードの行・位置を解析して反映する（OCRを介さず正確に取り込める）
        const parsed = parseChordSheetText(text);
        block.lyricLines = parsed.lyricLines;
        block.chords = parsed.chords;
      } else {
        block.lyricLines = textToLyricLines(text);
        // コード行がない場合は歌詞のみの更新とみなし、既存のコード配置は保持する
      }
      renderChordEditor(chordEditorEl, block, () => scheduleSave());
      scheduleSave();
    });

    const ocrFileInput = panel.querySelector('[data-role="ocr-file"]');
    const ocrStatus = panel.querySelector('[data-role="ocr-status"]');
    ocrFileInput.addEventListener('change', async () => {
      const file = ocrFileInput.files[0];
      if (!file) return;
      ocrStatus.textContent = '読み込み中...';
      try {
        const text = await recognizeImage(file, (status, progress) => {
          ocrStatus.textContent = `${status}（${Math.round(progress * 100)}%）`;
        });
        const textarea = panel.querySelector('[data-role="lyric-text"]');
        textarea.value = text.trim();
        ocrStatus.textContent = 'OCR完了。内容を確認・修正してから「反映」を押してください。';
      } catch (err) {
        ocrStatus.textContent = 'OCRに失敗しました: ' + err.message;
      }
      ocrFileInput.value = '';
    });
  });
}

function moveBlock(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= song.blocks.length) return;
  const [b] = song.blocks.splice(index, 1);
  song.blocks.splice(target, 0, b);
  renderBlocks();
  scheduleSave();
}

function duplicateBlock(index) {
  const original = song.blocks[index];
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  song.blocks.splice(index + 1, 0, copy);
  renderBlocks();
  scheduleSave();
}

function removeBlock(index) {
  if (song.blocks.length <= 1) return;
  if (!confirmDialog('このブロックを削除しますか？')) return;
  song.blocks.splice(index, 1);
  renderBlocks();
  scheduleSave();
}

document.getElementById('btn-add-block').addEventListener('click', () => {
  song.blocks.push(newBlock());
  renderBlocks();
  scheduleSave();
});

await renderBgThumbs();
renderBlocks();
