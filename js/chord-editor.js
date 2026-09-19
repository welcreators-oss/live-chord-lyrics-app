// 歌詞の上にコードを配置するエディタ。
// クリック＝新規配置、チップをクリック＝削除、チップをドラッグ＝位置調整。
//
// 全角の歌詞と半角スペースで位置調整されたコード行が混在すると、文字数に固定幅を
// 掛けるだけの計算では表示位置がずれるため、実際の文字幅を都度measureTextで測って使う。
const FONT_SPEC = '16px "Courier New", monospace';
let measureCtx = null;

function getMeasureCtx() {
  if (measureCtx) return measureCtx;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  measureCtx.font = FONT_SPEC;
  return measureCtx;
}

// 行頭からcol文字目までの実際の表示幅(px)
function widthUpToCol(lineText, col) {
  return getMeasureCtx().measureText(lineText.slice(0, col)).width;
}

// クリック/ドロップされたx座標(px)に最も近い文字位置(col)を返す
function colFromOffsetX(lineText, offsetX) {
  const ctx = getMeasureCtx();
  let acc = 0;
  for (let i = 0; i < lineText.length; i += 1) {
    const w = ctx.measureText(lineText[i]).width;
    if (acc + w / 2 > offsetX) return i;
    acc += w;
  }
  return lineText.length;
}

const DRAG_THRESHOLD_PX = 4;

export function renderChordEditor(container, block, onChange) {
  container.innerHTML = '';
  container.className = 'chord-editor';

  const lines = block.lyricLines.length ? block.lyricLines : [''];

  lines.forEach((lineText, lineIndex) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'lyric-line';
    lineEl.dataset.line = String(lineIndex);
    lineEl.textContent = lineText.length ? lineText : ' ';

    lineEl.addEventListener('click', (e) => {
      if (e.target !== lineEl) return; // チップ上のクリックは別ハンドラで処理
      const col = colFromOffsetX(lineText, e.offsetX);
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
        chip.style.left = `${widthUpToCol(lineText, chord.col)}px`;
        attachChipInteraction(chip, chord, block, container, onChange, lineText);
        lineEl.appendChild(chip);
      });
  });
}

function attachChipInteraction(chip, chord, block, container, onChange, lineText) {
  chip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startLeft = widthUpToCol(lineText, chord.col);
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
        chord.col = colFromOffsetX(lineText, newLeftPx);
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
