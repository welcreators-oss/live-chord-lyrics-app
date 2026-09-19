// OCR機能。本番中は使わないため、あえてvendor同梱せず「OCR実行」ボタン押下時にのみ
// CDN(jsDelivr)からTesseract.jsを動的読み込みする（配布サイズ削減のため）。
// 画像データ自体は外部送信されない（Tesseract.jsはブラウザ内(WASM)でOCR処理を行う）。
import { isPdfFile, renderPdfFirstPageToBlob } from './pdf-render.js';

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

// スマホ撮影のコード譜写真は暗さ・低コントラスト・文字が小さいことが多く、
// そのままではOCR精度が大きく落ちるため、認識前にグレースケール化・コントラスト強調・
// 必要なら拡大を行う。
const MIN_WIDTH = 1400;

async function preprocessImage(fileOrBlob) {
  const bitmap = await createImageBitmap(fileOrBlob);
  const scale = bitmap.width < MIN_WIDTH ? MIN_WIDTH / bitmap.width : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // グレースケール化しつつ明暗の範囲を記録
  let min = 255;
  let max = 0;
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    gray[p] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  // コントラストストレッチ（明暗差が小さい写真を見やすく引き伸ばす）
  const range = Math.max(max - min, 1);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const stretched = ((gray[p] - min) / range) * 255;
    data[i] = data[i + 1] = data[i + 2] = stretched;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || fileOrBlob), 'image/png'));
}

export async function recognizeImage(fileOrBlob, onProgress) {
  await loadTesseractScript();

  let source = fileOrBlob;
  if (isPdfFile(fileOrBlob)) {
    if (onProgress) onProgress('PDFを画像に変換中', 0);
    source = await renderPdfFirstPageToBlob(fileOrBlob);
  }

  let target = source;
  try {
    target = await preprocessImage(source);
  } catch (e) {
    // 前処理に失敗しても元画像でOCRを継続する
  }
  const result = await window.Tesseract.recognize(target, 'jpn+eng', {
    logger: (m) => {
      if (onProgress && m.status && typeof m.progress === 'number') {
        onProgress(m.status, m.progress);
      }
    },
  });
  return result.data.text;
}
