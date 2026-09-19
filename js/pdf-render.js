// PDFのコード譜からOCR取り込みできるよう、PDFの1ページ目を画像化する。
// OCR同様、本番中は使わないためvendor同梱せずCDNから動的読み込みする。
const PDFJS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js';
const RENDER_SCALE = 2.5; // OCR精度確保のため高めの解像度でレンダリング

let loadPromise = null;

function loadPdfjsScript() {
  if (window.pdfjsLib) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_SCRIPT_URL;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      resolve();
    };
    script.onerror = () => reject(new Error('PDF.jsの読み込みに失敗しました。ネット接続を確認してください。'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

// PDFの1ページ目をPNG画像(Blob)にレンダリングして返す
export async function renderPdfFirstPageToBlob(file) {
  await loadPdfjsScript();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
