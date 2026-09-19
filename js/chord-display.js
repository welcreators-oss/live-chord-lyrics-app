// 本番モード用の表示専用レンダラ（編集不可）。
// フォントサイズがvw単位で可変なため、実際の適用サイズをcanvasで実測して文字幅を求める。
let cachedCanvas = null;

function getCharWidthForElement(el) {
  const style = getComputedStyle(el);
  cachedCanvas = cachedCanvas || document.createElement('canvas');
  const ctx = cachedCanvas.getContext('2d');
  ctx.font = `${style.fontSize} ${style.fontFamily}`;
  return ctx.measureText('0').width;
}

export function renderStageBlock(container, block) {
  container.innerHTML = '';
  if (!block) return;
  const charWidth = getCharWidthForElement(container);
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
        chip.style.left = `${chord.col * charWidth}px`;
        lineEl.appendChild(chip);
      });
    container.appendChild(lineEl);
  });
}
