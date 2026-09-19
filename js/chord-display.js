// 本番モード用の表示専用レンダラ（編集不可）。
// フォントサイズがvw単位で可変なため、実際の適用サイズをcanvasで実測して使う。
// 全角の歌詞と半角スペースのコード行が混在しても位置がずれないよう、文字数固定幅ではなく
// 行頭からcol文字目までの実際の表示幅(measureText)でコードの位置を決める
// （chord-editor.jsの編集時の位置計算と同じ考え方）。
let cachedCanvas = null;

function getCtxForElement(el) {
  const style = getComputedStyle(el);
  cachedCanvas = cachedCanvas || document.createElement('canvas');
  const ctx = cachedCanvas.getContext('2d');
  ctx.font = `${style.fontSize} ${style.fontFamily}`;
  return ctx;
}

export function renderStageBlock(container, block) {
  container.innerHTML = '';
  if (!block) return;
  const ctx = getCtxForElement(container);
  const lines = block.lyricLines.length ? block.lyricLines : [''];
  lines.forEach((lineText, lineIndex) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'lyric-line';
    lineEl.textContent = lineText.length ? lineText : ' ';
    block.chords
      .filter((c) => c.line === lineIndex)
      .forEach((chord) => {
        const chip = document.createElement('span');
        chip.className = 'chord-chip';
        chip.textContent = chord.text;
        chip.style.left = `${ctx.measureText(lineText.slice(0, chord.col)).width}px`;
        lineEl.appendChild(chip);
      });
    container.appendChild(lineEl);
  });
}
