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

// コード譜テキストの位置合わせは、コード行が半角スペースで字下げされる一方、
// 歌詞行は全角文字が中心なので、単純な文字インデックスのままでは大きくずれる
// （全角文字は表示幅が半角の約2倍のため）。ここではコード行側は全て半角文字と
// みなして「col=半角換算の幅」として扱い、歌詞側も同様に全角=2・半角=1で
// 換算した表示幅を積み上げて対応する文字位置を探す。
function isFullWidthChar(ch) {
  const code = ch.codePointAt(0);
  return (
    (code >= 0x3000 && code <= 0x303f) || // CJK記号・句読点
    (code >= 0x3040 && code <= 0x30ff) || // ひらがな・カタカナ
    (code >= 0x3400 && code <= 0x4dbf) || // CJK拡張A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK統合漢字
    (code >= 0xff00 && code <= 0xffef)    // 全角英数字・記号
  );
}

function halfWidthUnitsToLyricIndex(lyricText, units) {
  let acc = 0;
  for (let idx = 0; idx < lyricText.length; idx += 1) {
    const w = isFullWidthChar(lyricText[idx]) ? 2 : 1;
    if (acc + w / 2 > units) return idx;
    acc += w;
  }
  return lyricText.length;
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
      const nextLine = rawLines[i + 1];
      const hasLyric = nextLine !== undefined && !isChordLine(nextLine);
      const lyricText = hasLyric ? nextLine : '';

      extractTokenPositions(line).forEach(({ col, text: chordText }) => {
        const mappedCol = hasLyric ? halfWidthUnitsToLyricIndex(lyricText, col) : col;
        chords.push({ line: lyricLineIndex, col: mappedCol, text: chordText });
      });

      lyricLines.push(lyricText);
      i += hasLyric ? 2 : 1;
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
