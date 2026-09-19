// OCR機能。本番中は使わないため、あえてvendor同梱せず「OCR実行」ボタン押下時にのみ
// CDN(jsDelivr)からTesseract.jsを動的読み込みする（配布サイズ削減のため）。
// 画像データ自体は外部送信されない（Tesseract.jsはブラウザ内(WASM)でOCR処理を行う）。
const TESSERACT_CDN_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let loadPromise = null;

function loadTesseractScript() {
  if (window.Tesseract) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_CDN_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Tesseract.jsの読み込みに失敗しました。ネット接続を確認してください。'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function recognizeImage(fileOrBlob, onProgress) {
  await loadTesseractScript();
  const result = await window.Tesseract.recognize(fileOrBlob, 'jpn+eng', {
    logger: (m) => {
      if (onProgress && m.status && typeof m.progress === 'number') {
        onProgress(m.status, m.progress);
      }
    },
  });
  return result.data.text;
}
