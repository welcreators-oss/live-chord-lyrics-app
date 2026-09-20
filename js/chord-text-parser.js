// 「コード行＋歌詞行が交互に並ぶ」形式のテキスト（多くのコード譜サイトの表記と同じ）を
// パースし、歌詞行とコード配置（行番号・文字位置）に変換する。OCRを介さずに、
// 既存のテキストのコード譜をそのまま貼り付けて正確に取り込みたい場合に使う。
const CHORD_TOKEN_RE = /^[A-G](#|##|b|bb)?(maj|min|dim|aug|sus2|sus4|sus|add|m|M)?[0-9]*([+-]5)?(\/[A-G](#|b)?)?$/;

function isChordToken(token) {
  return CHORD_TOKEN_RE.test(token);
}

// 行全体が「コード名とスペースのみ」で構成されているか判定
function isChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/);
  return tokens.every(isChordToken);
}

function extractTokenPositions(line) {
  const result = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) {
    result.push({ col: m.index, text: m[0] });
  }
  return result;
}

export function containsChordLine(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return lines.some(isChordLine);
}

// 空行（1行以上の空白行）をAメロ／Bメロ／サビ等のセクション区切りとみなして分割する。
// OCR結果やコード譜テキストをまとめて貼り付けたときに、ブロックへ自動分割するために使う。
export function splitIntoSections(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t　]*\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 戻り値: { lyricLines: string[], chords: {line, col, text}[] }
export function parseChordSheetText(text) {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n');
  const lyricLines = [];
  const chords = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    if (isChordLine(line)) {
      const lyricLineIndex = lyricLines.length;
      extractTokenPositions(line).forEach(({ col, text: chordText }) => {
        chords.push({ line: lyricLineIndex, col, text: chordText });
      });
      const nextLine = rawLines[i + 1];
      if (nextLine !== undefined && !isChordLine(nextLine)) {
        lyricLines.push(nextLine);
        i += 2;
      } else {
        // 次の行も無い／コード行が連続する場合は空の歌詞行を挿んでコード位置を保持
        lyricLines.push('');
        i += 1;
      }
    } else {
      lyricLines.push(line);
      i += 1;
    }
  }

  // 末尾の空行は削除（コピペ時に付きがちな余分な改行を除く）。
  // ただし、コードだけで歌詞の無い行（イントロ・間奏等）にはコードがline番号で
  // 紐づいているため、それを削除するとコードごと表示されなくなる。その行は保護する。
  while (
    lyricLines.length > 0 &&
    lyricLines[lyricLines.length - 1] === '' &&
    !chords.some((c) => c.line === lyricLines.length - 1)
  ) {
    lyricLines.pop();
  }

  return { lyricLines, chords };
}
