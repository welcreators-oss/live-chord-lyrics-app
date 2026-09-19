import { getSetting } from '../db.js';
import { listSongs, getSong } from '../songs.js';
import { getAll } from '../db.js';
import { getImageUrl, listImagesByKind } from '../images.js';
import { attachPedalListener } from '../pedal.js';
import { renderStageBlock } from '../chord-display.js';
import { escapeHtml } from '../common.js';

const els = {
  empty: document.getElementById('stage-empty'),
  bg: document.getElementById('stage-bg'),
  blackout: document.getElementById('stage-blackout'),
  lyrics: document.getElementById('stage-lyrics'),
  status: document.getElementById('stage-status'),
  panel: document.getElementById('song-panel'),
  panelList: document.getElementById('song-panel-list'),
};

const STATE_KEY = 'stage-state-v1';

let songs = []; // このセットリストに含まれる曲データ（削除済み除く）
let commonBackgrounds = [];
let commonBgMode = 'sequential';
let commonBgCursor = 0;

let songIndex = 0;
let blockIndex = 0;
let currentBgKeyForSong = null; // 直近に背景を決めた曲id（曲が変わった時だけ再抽選するため）

function saveState(setlistId) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ setlistId, songIndex, blockIndex }));
  } catch (e) { /* 端末容量等で失敗しても本番動作は継続 */ }
}

function loadState(setlistId) {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state.setlistId !== setlistId) return null;
    return state;
  } catch (e) {
    return null;
  }
}

async function pickBackgroundUrl(song) {
  const ids = song.backgroundImageIds || [];
  if (ids.length > 0) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    return getImageUrl(id);
  }
  if (commonBackgrounds.length === 0) return null;
  let img;
  if (commonBgMode === 'random') {
    img = commonBackgrounds[Math.floor(Math.random() * commonBackgrounds.length)];
  } else {
    img = commonBackgrounds[commonBgCursor % commonBackgrounds.length];
    commonBgCursor += 1;
  }
  return getImageUrl(img.id);
}

async function updateDisplay({ resetBackground = false } = {}) {
  const song = songs[songIndex];
  if (!song) return;
  const block = song.blocks[blockIndex];
  renderStageBlock(els.lyrics, block);
  els.status.textContent = `${song.title}（${songIndex + 1}/${songs.length}） ブロック ${blockIndex + 1}/${song.blocks.length}`;

  if (resetBackground || currentBgKeyForSong !== song.id) {
    currentBgKeyForSong = song.id;
    const url = await pickBackgroundUrl(song);
    if (url) {
      els.bg.src = url;
      els.bg.style.visibility = 'visible';
    } else {
      els.bg.style.visibility = 'hidden';
    }
  }
  renderPanel();
}

function renderPanel() {
  els.panelList.innerHTML = songs.map((s, i) => `
    <div class="panel-song-item ${i === songIndex ? 'current' : ''}" data-index="${i}">${i + 1}. ${escapeHtml(s.title)}</div>
  `).join('');
}

let activeSetlistId = null;

async function goNext() {
  const song = songs[songIndex];
  if (!song) return;
  if (blockIndex < song.blocks.length - 1) {
    blockIndex += 1;
  } else if (songIndex < songs.length - 1) {
    songIndex += 1;
    blockIndex = 0;
  } else {
    return; // 最後の曲の最後のブロック
  }
  saveState(activeSetlistId);
  await updateDisplay();
}

async function goPrev() {
  if (blockIndex > 0) {
    blockIndex -= 1;
  } else if (songIndex > 0) {
    songIndex -= 1;
    blockIndex = songs[songIndex].blocks.length - 1;
  } else {
    return; // 最初の曲の最初のブロック
  }
  saveState(activeSetlistId);
  await updateDisplay();
}

function toggleBlackout(force) {
  const next = typeof force === 'boolean' ? force : els.blackout.hidden;
  els.blackout.hidden = !next;
}

document.getElementById('btn-blackout').addEventListener('click', () => toggleBlackout());
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});
document.getElementById('btn-toggle-panel').addEventListener('click', () => {
  els.panel.hidden = !els.panel.hidden;
});
els.panelList.addEventListener('click', async (e) => {
  const item = e.target.closest('.panel-song-item');
  if (!item) return;
  songIndex = Number(item.dataset.index);
  blockIndex = 0;
  saveState(activeSetlistId);
  els.panel.hidden = true;
  await updateDisplay({ resetBackground: true });
});

// 画面タップ：左半分=前へ／右半分=次へ（ボタンやパネル操作は個別ハンドラが先にstopPropagationしないため、対象を絞る）
document.getElementById('stage-lyrics').addEventListener('click', () => {});
document.body.addEventListener('click', (e) => {
  if (e.target.closest('.stage-topbar') || e.target.closest('.song-panel')) return;
  const x = e.clientX;
  const half = window.innerWidth / 2;
  if (x < half) goPrev(); else goNext();
});

window.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    toggleBlackout();
  } else if (e.key === 'Escape') {
    if (!els.blackout.hidden) toggleBlackout(false);
  }
});

attachPedalListener({ onPrev: goPrev, onNext: goNext });

window.addEventListener('resize', () => {
  const song = songs[songIndex];
  if (song) renderStageBlock(els.lyrics, song.blocks[blockIndex]);
});

async function init() {
  activeSetlistId = await getSetting('currentSetlistId', null);
  const setlists = await getAll('setlists');
  const setlist = setlists.find((s) => s.id === activeSetlistId);

  if (!setlist || setlist.songIds.length === 0) {
    els.empty.hidden = false;
    return;
  }

  const allSongs = await listSongs();
  const songsById = Object.fromEntries(allSongs.map((s) => [s.id, s]));
  songs = setlist.songIds.map((id) => songsById[id]).filter(Boolean);

  if (songs.length === 0) {
    els.empty.hidden = false;
    return;
  }

  commonBackgrounds = await listImagesByKind('common');
  commonBgMode = await getSetting('commonBackgroundMode', 'sequential');

  const saved = loadState(activeSetlistId);
  if (saved && saved.songIndex < songs.length) {
    songIndex = saved.songIndex;
    blockIndex = Math.min(saved.blockIndex, songs[songIndex].blocks.length - 1);
  }

  await updateDisplay({ resetBackground: true });
}

init();
