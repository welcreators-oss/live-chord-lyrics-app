import { renderHeader } from '../common.js';
import { attachPedalListener } from '../pedal.js';

renderHeader('pages/settings.html');

const box = document.getElementById('pedal-test-box');
const lastKeyEl = document.getElementById('pedal-last-key');
const resultEl = document.getElementById('pedal-result');

box.addEventListener('keydown', () => {}); // フォーカス確保用（実処理はwindowのkeydownで拾う）

attachPedalListener({
  onPrev: () => { resultEl.textContent = '「前へ」を検知しました'; resultEl.style.color = '#2e7d32'; },
  onNext: () => { resultEl.textContent = '「次へ」を検知しました'; resultEl.style.color = '#2e7d32'; },
  onAnyKey: (key) => { lastKeyEl.textContent = key; },
});
