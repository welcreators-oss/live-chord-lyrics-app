import { renderHeader, confirmDialog } from '../common.js';
import { getAll, put, clearAll } from '../db.js';

renderHeader('pages/backup.html');

const exportBtn = document.getElementById('btn-export');
const exportStatus = document.getElementById('export-status');
const importFile = document.getElementById('import-file');
const importBtn = document.getElementById('btn-import');
const importStatus = document.getElementById('import-status');

function dateStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

exportBtn.addEventListener('click', async () => {
  exportStatus.textContent = '書き出し中...';
  try {
    const [songs, images, setlists, settings] = await Promise.all([
      getAll('songs'), getAll('images'), getAll('setlists'), getAll('settings'),
    ]);

    const zip = new window.JSZip();
    zip.file('data.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      songs,
      setlists,
      settings,
      imagesMeta: images.map(({ id, name, kind, createdAt }) => ({ id, name, kind, createdAt })),
    }, null, 2));

    const imgFolder = zip.folder('images');
    for (const img of images) {
      imgFolder.file(img.id, img.blob);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-chord-backup-${dateStamp()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    exportStatus.textContent = '書き出しが完了しました';
  } catch (err) {
    exportStatus.textContent = '失敗しました: ' + err.message;
  }
});

importBtn.addEventListener('click', async () => {
  const file = importFile.files[0];
  if (!file) { importStatus.textContent = 'zipファイルを選択してください'; return; }
  if (!confirmDialog('現在のデータはすべて削除され、このファイルの内容で置き換えられます。よろしいですか？')) return;

  importStatus.textContent = '復元中...';
  try {
    const zip = await window.JSZip.loadAsync(file);
    const dataText = await zip.file('data.json').async('string');
    const data = JSON.parse(dataText);

    const images = [];
    for (const meta of data.imagesMeta || []) {
      const entry = zip.file(`images/${meta.id}`);
      if (!entry) continue;
      const blob = await entry.async('blob');
      images.push({ ...meta, blob });
    }

    await clearAll();
    for (const song of data.songs || []) await put('songs', song);
    for (const setlist of data.setlists || []) await put('setlists', setlist);
    for (const setting of data.settings || []) await put('settings', setting);
    for (const img of images) await put('images', img);

    importStatus.textContent = '復元が完了しました';
  } catch (err) {
    importStatus.textContent = '失敗しました: ' + err.message;
  }
});
