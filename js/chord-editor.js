// 歌詞の上にコードを配置するエディタ。
// クリック＝新規配置、チップをクリック＝削除、チップをドラッグ＝位置調整。
const FONT_SPEC = '16px "Courier New", monospace';
let charWidthCache = null;

function getCharWidth() {
  if (charWidthCache) return charWidthCache;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = FONT_SPEC;
  charWidthCache = ctx.measureText('0').width;
  return charWidthCache;
}

const DRAG_THRESHOLD_PX = 4;

export function renderChordEditor(container, block, onChange) {
  container.innerHTML = '';
  container.className = 'chord-editor';
  const charWidth = getCharWidth();

  const lines = block.lyricLines.length ? block.lyricLines : [''];

  lines.forEach((lineText, lineIndex) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'lyric-line';
    lineEl.dataset.line = String(lineIndex);
    lineEl.textContent = lineText.length ? lineText : ' ';

    lineEl.addEventListener('click', (e) => {
      if (e.target !== lineEl) return; // チップ上のクリックは別ハンドラで処理
      const col = Math.max(0, Math.round(e.offsetX / charWidth));
      const name = window.prompt('コード名を入力してください（例: Am7, C, G/B）', '');
      if (!name) return;
      block.chords.push({ line: lineIndex, col, text: name.trim() });
      renderChordEditor(container, block, onChange);
      onChange(block);
    });

    container.appendChild(lineEl);

    block.chords
      .filter((c) => c.line === lineIndex)
      .forEach((chord) => {
        const chip = document.createElement('span');
        chip.className = 'chord-chip';
        chip.textContent = chord.text;
        chip.style.left = `${chord.col * charWidth}px`;
        attachChipInteraction(chip, chord, block, container, onChange, charWidth);
        lineEl.appendChild(chip);
      });
  });
}

function attachChipInteraction(chip, chord, block, container, onChange, charWidth) {
  chip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startLeft = chord.col * charWidth;
    let dragging = false;
    chip.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) dragging = true;
      if (dragging) {
        const newLeft = Math.max(0, startLeft + dx);
        chip.style.left = `${newLeft}px`;
      }
    };
    const onUp = () => {
      chip.removeEventListener('pointermove', onMove);
      chip.removeEventListener('pointerup', onUp);
      if (dragging) {
        const newLeftPx = parseFloat(chip.style.left);
        chord.col = Math.max(0, Math.round(newLeftPx / charWidth));
        onChange(block);
        renderChordEditor(container, block, onChange);
      } else {
        if (window.confirm(`コード「${chord.text}」を削除しますか？`)) {
          const idx = block.chords.indexOf(chord);
          if (idx >= 0) block.chords.splice(idx, 1);
          onChange(block);
          renderChordEditor(container, block, onChange);
        }
      }
    };
    chip.addEventListener('pointermove', onMove);
    chip.addEventListener('pointerup', onUp);
  });
}
