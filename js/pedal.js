// LEKATOフットペダル（モード3: ArrowUp=前へ / ArrowDown=次へ）の入力処理。
// Bluetooth HIDキーボードとして認識されるため、実体はkeydownイベントの監視。
const PREV_KEYS = new Set(['ArrowUp']);
const NEXT_KEYS = new Set(['ArrowDown']);

export function attachPedalListener({ onPrev, onNext, onAnyKey, debounceMs = 220 } = {}) {
  let lastFireAt = 0;
  const handler = (e) => {
    if (onAnyKey) onAnyKey(e.key);
    const isPrev = PREV_KEYS.has(e.key);
    const isNext = NEXT_KEYS.has(e.key);
    if (!isPrev && !isNext) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastFireAt < debounceMs) return; // 二重送り防止
    lastFireAt = now;
    if (isPrev && onPrev) onPrev();
    if (isNext && onNext) onNext();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
