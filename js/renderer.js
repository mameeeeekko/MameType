// renderer.js
// =====================================================
// 画面描画・UI更新・サウンド再生など「表示まわり」を一括管理するモジュール
// gameCore から呼ばれ、ゲーム状態に応じて DOM を更新する役割を持つ
// =====================================================
import { getDisplayFullRoma } from "./typingLogic.js";
import { getNow, getPaused } from "./gameCore.js";
import { GameModes } from "./gameModes.js";
import { gameState } from "./gameCore.js"; // Import gameState
/* =====================================================
  ユーティリティ
  ===================================================== */
// テキストが英数字・記号のみ（英語問題）か判定
const isEnglish = (str) => /^[a-zA-Z0-9\s.,!?-]+$/.test(str);

/* =====================================================
  DOM キャッシュヘルパ
  ===================================================== */
const dom = {
wordWrap: () => document.getElementById("word-wrap"),
jpWrap: () => document.getElementById("jp-wrap"),
romaWrap: () => document.getElementById("roma-wrap"),
wordLongWrap: () => document.getElementById("word-long-wrap"),
scrollWrap: () => document.getElementById("scroll-wrap"),

word: () => document.getElementById("word"),
wordLong: () => document.getElementById("word-long"),
kanaScroll: () => document.getElementById("kana-scroll"),
romaScroll: () => document.getElementById("roma-scroll"),
jp: () => document.getElementById("jp"),
roma: () => document.getElementById("roma"),

stats: () => document.getElementById("stats"),

timeLeft: () => document.getElementById("timeLeft"),
timeBar: () => document.getElementById("time-bar"),
timeBarContainer: () => document.getElementById("time-bar-container"),

timeCircleContainer: () => document.getElementById("time-circle-container"),
timeCircle: () => document.getElementById("time-circle"),
timeCircleText: () => document.getElementById("time-circle-text"),

speedBar: () => document.getElementById("speed-bar"),
speedLabel: () => document.getElementById("speed-label"),

progressBlocks: () => document.getElementById("progress-blocks"),
progressBar: () => document.getElementById("progress-bar"),
progressText: () => document.getElementById("progress-text"),

resultStats: () => document.getElementById("resultStats"),
resultTime: () => document.getElementById("resultTime"),
game: () => document.getElementById("game"),
result: () => document.getElementById("result"),

solvedCount: () => document.getElementById("solvedCount"),
freeModeBadge: () => document.getElementById("freeModeBadge"),
missModeBadge: () => document.getElementById("missModeBadge"),
bgmInfoDisplay: () => document.getElementById("bgmInfoDisplay"), // New BGM info display element

};

/* =====================================================
  1. モード切替管理（長文モード用）
  ===================================================== */

let isLongTextMode = false;

export function setLongTextMode(flag) {
  isLongTextMode = !!flag;

  const wordWrap = dom.wordWrap();   // ★追加
  const jpWrap = dom.jpWrap();
  const romaWrap = dom.romaWrap();
  const wordLongWrap = dom.wordLongWrap();
  const scrollWrap = dom.scrollWrap();

  if (isLongTextMode) {
    if (wordWrap) wordWrap.style.display = "none";   // ★重要
    if (jpWrap) jpWrap.style.display = "none";
    if (romaWrap) romaWrap.style.display = "none";
    if (wordLongWrap) wordLongWrap.style.display = "block";
    if (scrollWrap) scrollWrap.style.display = "block";
  } else {
    if (wordWrap) wordWrap.style.display = "block";  // ★重要
    if (jpWrap) jpWrap.style.display = "block";
    if (romaWrap) romaWrap.style.display = "block";
    if (wordLongWrap) wordLongWrap.style.display = "none";
    if (scrollWrap) scrollWrap.style.display = "none";
  }
}

// ===============================
// UIモード切替
// ===============================
export function setUIMode(mode, GameModes) {
const progressContainer = document.getElementById("progress-container");
const timeEl = dom.timeLeft();
const timeBarContainer = dom.timeBarContainer();
const circle = dom.timeCircleContainer();

if (!progressContainer || !timeEl || !timeBarContainer) return;

if (mode === GameModes.TIME_ATTACK) {
  circle.style.display = "none"; // 既存バー優先
  progressContainer.style.display = "none";
  timeEl.style.display = "block";
  timeBarContainer.style.display = "block";
} else if (mode === GameModes.LONG_TEXT) {
  circle.style.display = "block"; // 通常・長文は円
  progressContainer.style.display = "none";
  timeEl.style.display = "none";
  timeBarContainer.style.display = "none";
} else {
  circle.style.display = "block"; // 通常・長文は円
  progressContainer.style.display = "block";
  timeEl.style.display = "none";
  timeBarContainer.style.display = "none";
}
}

/* =====================================================
  経過時間表示
  ===================================================== */
let circleStart = 0;
let circleDuration = 0;
let circleRaf = null;

export function initTimeCircle(modeId) {
  const container = dom.timeCircleContainer();
  if (!container) return;

  // ★ここが重要
  if (modeId === GameModes.TIME_ATTACK.id) {
    container.style.display = "none";
    stopTimeCircle?.();
    return;
  }

  container.style.display = "block";

  circleStart = getNow();
  circleDuration = 60 * 1000;

  cancelAnimationFrame(circleRaf);
  updateCircle();
}

export function updateCircle() {
  if (getPaused()) {
    circleRaf = requestAnimationFrame(updateCircle);
    return;
  }

  const circle = dom.timeCircle();
  if (!circle) return;

  const label = circle.querySelector(".label");
  const count = circle.querySelector(".count");

  const now = getNow();
  const elapsed = now - circleStart;

  // 何周目か
  const cycle = Math.floor(elapsed / circleDuration);

  // 1周内の進行率 0〜1
  const ratio = (elapsed % circleDuration) / circleDuration;
  const angle = ratio * 360;

  // 周回ごとに色反転
  const isFilling = cycle % 2 === 0;

  const filledColor = isFilling ? "#616161" : "#e5e7eb";
  const emptyColor = isFilling ? "#e5e7eb" : "#616161";

  circle.style.background = `conic-gradient(
    ${filledColor} 0deg ${angle}deg,
    ${emptyColor} ${angle}deg 360deg
  )`;

  if (label) label.textContent = "TIME";
  if (count) count.textContent = Math.ceil(elapsed / 1000);

  circleRaf = requestAnimationFrame(updateCircle);
}

export function stopTimeCircle() {
  cancelAnimationFrame(circleRaf);
  circleRaf = null;

  const container = dom.timeCircleContainer();
  if (container) container.style.display = "none";
}
/* =====================================================
  2. タイムバー・残り時間表示
  ===================================================== */

let timeBarRafId = null;
let timeBarStart = 0;
let timeBarDuration = 0;

export function initTimeBar(limitSec) {
const bar = dom.timeBar();
if (!bar) return;

timeBarStart = getNow();
timeBarDuration = limitSec * 1000;
bar.style.width = "100%";

cancelAnimationFrame(timeBarRafId);
timeBarRafId = requestAnimationFrame(tickTimeBar);
}

function tickTimeBar() {
const bar = dom.timeBar();
if (!bar) return;

// ★ポーズ中は止める
if (getPaused()) {
  timeBarRafId = requestAnimationFrame(tickTimeBar);
  return;
}

const now = getNow();
const elapsed = now - timeBarStart;
const ratio = Math.max(1 - elapsed / timeBarDuration, 0);

bar.style.width = (ratio * 100) + "%";

if (ratio > 0) {
  timeBarRafId = requestAnimationFrame(tickTimeBar);
}
}

export function stopTimeBar() {
if (timeBarRafId) {
  cancelAnimationFrame(timeBarRafId);
  timeBarRafId = null;
}
}

export function setTimeLeft(sec) {
const el = dom.timeLeft();
const bar = dom.timeBar();
if (!el || !bar) return;

if (sec === null) {
  el.textContent = "";
  bar.style.width = "0%";
} else {
  el.innerHTML = `<span class="time-num">${sec}</span><span class="time-unit"> 秒</span>`;
}
}


/* =====================================================
   タイムアタック時のクリア数表示
  ===================================================== */

export function setSolvedCount(count, modeId) {
  const el = dom.solvedCount();
  if (!el) return;

  // 円の中の要素を取得
  const label = el.querySelector(".label");
  const countEl = el.querySelector(".count");

  if (modeId !== "time_attack" || count === null) {
    el.style.display = "none";   // 非表示にする
  } else {
    el.style.display = "flex";   // 表示（flex前提）
    
    if (label) label.textContent = "CLEAR";
    if (countEl) {
      countEl.textContent = count;
      countEl.animate(
        [{ transform: "scale(1.3)" }, { transform: "scale(1)" }],
        { duration: 200 }
      );
    }
  }
}

/* =====================================================
  3. スピードバー（KPM表示）
  ===================================================== */

let speedBarEl = null;
let speedLabelEl = null;

export function initSpeedBar() {
speedBarEl = dom.speedBar();
speedLabelEl = dom.speedLabel();
if (speedBarEl) speedBarEl.style.width = "0%";
if (speedLabelEl) speedLabelEl.textContent = "0 WPM";
}

const MAX_KPM = 700;

export function updateSpeedBar(kpm) {
if (!speedBarEl || !speedLabelEl) return;

const ratio = Math.min(kpm / MAX_KPM, 1);
const percent = ratio * 100;

speedBarEl.style.width = percent + "%";
speedLabelEl.textContent = Math.round(kpm) + " KPM";
}

/* =====================================================
  4. タイムアタック用 残り時間バー（滑らかに減る）
  ===================================================== */

export function startTimeAttackBar(durationSec) {
const container = dom.timeBarContainer();
const bar = dom.timeBar();
if (!container || !bar) return;

container.style.display = "block";

timeBarStart = performance.now();
timeBarDuration = durationSec * 1000;
bar.style.transform = "scaleX(1)";

updateTimeBarSmooth();
}

function updateTimeBarSmooth() {
const bar = dom.timeBar();
if (!bar) return;

const now = performance.now();
const elapsed = now - timeBarStart;
const ratio = Math.max(1 - elapsed / timeBarDuration, 0);

bar.style.transform = `scaleX(${ratio})`;

if (ratio > 0) {
  timeBarRafId = requestAnimationFrame(updateTimeBarSmooth);
}
}

export function stopTimeAttackBar() {
cancelAnimationFrame(timeBarRafId);
const container = dom.timeBarContainer();
if (container) container.style.display = "none";
}

/* =====================================================
  5. プログレスバー（問題進行状況）
  ===================================================== */

let progressBlocks = [];

export function initProgressBar(total) {
const container = dom.progressBlocks();
container.innerHTML = "";
progressBlocks = [];

for (let i = 0; i < total; i++) {
  const block = document.createElement("div");
  block.className = "progress-block";
  block.style.width = (100 / total) + "%";
  container.appendChild(block);
  progressBlocks.push(block);
}
}

export function markProgressDoneFromRight(currentIndex) {
const index = progressBlocks.length - 1 - currentIndex;
if (progressBlocks[index]) progressBlocks[index].classList.add("done");
}

export function updateProgressBar(currentIndex, total) {
const bar = dom.progressBar();
if (!bar || total === 0) return;

const ratio = (total - currentIndex) / total;
bar.style.width = (ratio * 100) + "%";
}

export function updateProgressText(currentIndex, total) {
  const el = dom.progressText();
  if (!el) return;

  const remain = total - currentIndex;
  el.textContent = `${remain} / ${total}`;
}

/* =====================================================
  6. メイン描画処理
  ===================================================== */

let lastRomaText = "";
let lastTypedLen = -1;
let pendingRender = false;


export function render(state) {

  if (pendingRender) return;
  pendingRender = true;

  requestAnimationFrame(() => {
    pendingRender = false;

    renderWordDisplay(state);

    if (isLongTextMode) {
      renderLongText(state);
    } else {
      renderNormal(state);
    }

    renderStats(state);
    renderFreeModeBadge(state.isFreeMode); // Existing
    renderMissModeBadge(state.isMissPractice); // Existing
    renderBgmInfo(getNow()); // Call new BGM info rendering function
  });
}

let longWordSpans = [];
let lastLongText = "";

// 長文用のセグメント情報をキャッシュする
let currentFinalSegments = [];

/**
 * 前のゲームの描画キャッシュ（前回のテキストなど）をクリアし、
 * リトライや新規ゲーム開始時に画面が正常に初期化されるようにする
 */
export function resetRendererState() {
  lastRomaText = "";
  lastTypedLen = -1;
  lastLongText = "";
  longWordSpans = [];
  currentFinalSegments = [];

  const wordLong = dom.wordLong();
  if (wordLong) wordLong.innerHTML = "";

  const wordLongWrap = dom.wordLongWrap();
  if (wordLongWrap) wordLongWrap.scrollTop = 0;

  const roma = dom.roma();
  if (roma) roma.innerHTML = "";

  const kanaScroll = dom.kanaScroll();
  if (kanaScroll) kanaScroll.innerHTML = "";

  const romaScroll = dom.romaScroll();
  if (romaScroll) romaScroll.innerHTML = "";

  const word = dom.word();
  if (word) word.innerHTML = "";

  const jp = dom.jp();
  if (jp) jp.innerHTML = "";
}

/**
 * 表示用漢字と読みのリストを同期したセグメント配列に変換する
 * segments が空の場合は word と text の差分から自動生成する
 */
function buildFinalSegments(displayWord, text, segments) {
  // ★重要：計算前に、表示用・読み用の両方で改行とインデントスペースをまとめて1文字スペースに統一する
  // これにより、空白の行は何もないものとして扱える
  const cleanedText = text.replace(/(\r?\n[ 　]*)+/g, ' ');

  const displayIndexMap = [];
  let cleanedDisplayWord = '';
  let cleanedIndex = 0;
  let inNewlineGroup = false;

  for (let i = 0; i < displayWord.length; i++) {
    const char = displayWord[i];
    if (char === '\r') continue;
    if (char === '\n') {
      if (!inNewlineGroup) {
        displayIndexMap[i] = cleanedIndex;
        cleanedDisplayWord += ' ';
        cleanedIndex += 1;
        inNewlineGroup = true;
      } else {
        displayIndexMap[i] = cleanedIndex - 1;
      }
      continue;
    }

    if (inNewlineGroup && (char === ' ' || char === '　')) {
      displayIndexMap[i] = -1;
      continue;
    }

    inNewlineGroup = false;
    displayIndexMap[i] = cleanedIndex;
    cleanedDisplayWord += char;
    cleanedIndex += 1;
  }

  // 漢字、々、〇、に加え、カタカナ（全角・半角）もマッピング対象に含める
  const kanjiRegex = /[\u4E00-\u9FFF\u3005\u3007\u303B\uF900-\uFAFF\u30A0-\u30FF\uFF66-\uFF9F]+/g;
  const result = [];

  // 1. 非漢字（ひらがな等）を「固定点（ピン）」として抽出
  const pins = [];
  let last = 0;
  for (const m of [...cleanedDisplayWord.matchAll(kanjiRegex)]) {
    if (m.index > last) pins.push({ s: cleanedDisplayWord.slice(last, m.index), d: last });
    last = m.index + m[0].length;
  }
  if (last < cleanedDisplayWord.length) pins.push({ s: cleanedDisplayWord.slice(last), d: last });

  // 2. 読みテキスト（text）側でのピンの正確な位置を特定
  let searchFrom = 0;
  pins.forEach(p => {
    const cleanS = p.s.replace(/[、。，．,.？！?! ]/g, "");
    let found = cleanedText.indexOf(p.s, searchFrom);
    let matchedLen = p.s.length;

    if (found === -1) {
      if (cleanS !== "") {
        found = text.indexOf(cleanS, searchFrom);
        matchedLen = cleanS.length;
      } else {
        // 句読点のみで text に見つからない場合は、長さ0（読みには存在しない）として扱う
        found = -1;
      }
    }

    if (found !== -1) {
      p.t = found;
      p.len = matchedLen;
      searchFrom = found + matchedLen;
    } else {
      p.t = Math.floor((p.d / cleanedDisplayWord.length) * cleanedText.length);
      p.len = cleanS.length;
      searchFrom = p.t + p.len;
    }
  });

  // 3. 表示文字1文字ずつに対して読みを割り当てる
  let kIdx = 0;
  const kanjiMatches = [...cleanedDisplayWord.matchAll(kanjiRegex)];

  for (let i = 0; i < displayWord.length; i++) {
    const char = displayWord[i];
    const cleanedPos = displayIndexMap[i];

    if (char === '\r') continue;
    if (cleanedPos === -1) {
      const prevStart = result.length > 0 ? result[result.length - 1].start : 0;
      result.push({ w: char, t: "", start: prevStart });
      continue;
    }

    const m = kanjiMatches.find(x => cleanedPos >= x.index && cleanedPos < x.index + x[0].length);

    if (m) {
      // 漢字の場合：前後のピンから読みの範囲を特定し、等分する
      const nextP = pins.find(p => p.d >= m.index + m[0].length);
      const prevP = [...pins].reverse().find(p => p.d + p.s.length <= m.index);
      const bStartT = prevP ? prevP.t + (prevP.len || 0) : 0;
      const bEndT = nextP ? nextP.t : cleanedText.length;
      const bRead = text.slice(bStartT, bEndT);

      let r;
      const sub = cleanedPos - m.index;
      if (segments && segments[kIdx]) {
        r = segments[kIdx];
      } else {
        const rLen = bRead.length / m[0].length;
        const sIdx = Math.floor(sub * rLen);
        const eIdx = (sub === m[0].length - 1) ? bRead.length : Math.floor((sub + 1) * rLen);
        r = bRead.slice(sIdx, eIdx);
      }
      const rLen = bRead.length / m[0].length;
      result.push({ w: char, t: r, start: bStartT + Math.floor(sub * rLen) });
      if (cleanedPos === m.index + m[0].length - 1) kIdx += m[0].length;
    } else {
      // 非漢字の場合：特定したピンの座標をそのまま使う
      const p = pins.find(x => cleanedPos >= x.d && cleanedPos < x.d + x.s.length);
      result.push({ w: char, t: char, start: p.t + (cleanedPos - p.d) });
    }
  }
  return result;
}

function renderWordDisplay(state) {
  const { displayWord, pos, text, segments } = state;
  const wordDiv = isLongTextMode ? dom.wordLong() : dom.word();
  if (!wordDiv) return;

  // 英語問題の場合はメインの単語表示を非表示に
  if (isEnglish(text)) {
    wordDiv.style.display = "hidden";
  } else {
    wordDiv.style.display = "block";
  }

  // 通常
  if (!isLongTextMode) {
    wordDiv.textContent = displayWord;
    return;
  }

  // テキストまたは表示用漢字が変わった場合のみ再生成
  const cacheKey = displayWord + "|" + text;
  if (cacheKey !== lastLongText) {
    lastLongText = cacheKey;
    wordDiv.innerHTML = "";
    longWordSpans = [];
    currentFinalSegments = buildFinalSegments(displayWord, text, segments);

    const frag = document.createDocumentFragment();
    for (let i = 0; i < displayWord.length; i++) {
      const char = displayWord[i];
      if (char === '\n') {
        frag.appendChild(document.createElement('br'));
      } else {
        const span = document.createElement("span");
        span.textContent = char;
        frag.appendChild(span);
        longWordSpans.push(span);
      }
    }
    wordDiv.appendChild(frag);
  }

  // ハイライト状態の更新
  let activeKanjiIdx = 0;
  let currentSpanIndex = 0; // 現在の文字の<span>要素のインデックス
  let foundCurrent = false;
  const EPSILON = 0.1; // わずかな入力誤差を許容
  let spanIndex = 0; // longWordSpans用のインデックス

  for (let i = 0; i < currentFinalSegments.length; i++) {
    const seg = currentFinalSegments[i];
    if (seg.w === '\n') continue; // 改行セグメントはスキップ

    const span = longWordSpans[spanIndex];
    if (!span) continue;


    const charDoneAt = seg.start + (seg.t ? seg.t.length : 0);

    if (pos >= charDoneAt - EPSILON) {
      span.className = "done";
    } else if (!foundCurrent) {
      span.className = "current";
      activeKanjiIdx = i;
      currentSpanIndex = spanIndex;
      foundCurrent = true;
    } else {
      span.className = "";
    }
    spanIndex++;
  }

  if (!foundCurrent) {
    currentSpanIndex = Math.max(0, longWordSpans.length - 1);
  }

// ===== 中央追従スクロール =====
const container = dom.wordLongWrap();
const current = longWordSpans[currentSpanIndex];
if (!container || !current) return;

const containerHeight = container.clientHeight;
const contentHeight = container.scrollHeight;

// 現在文字の中央位置
const charCenter = current.offsetTop + current.offsetHeight / 2;

// 目標スクロール位置（中央配置）
let targetScroll = charCenter - containerHeight / 2;

// ----- 下端クランプ（最後で止める）-----
const maxScroll = contentHeight - containerHeight;
if (targetScroll > maxScroll) targetScroll = maxScroll;

// ----- 上端クランプ -----
if (targetScroll < 0) targetScroll = 0;

// 適用
container.scrollTop = targetScroll;
}

function renderLongText(state) {

  const { text, pos, typed, inputedRomaji } = state;
  
  // --- かな表示 ---
  const kanaScroll = dom.kanaScroll();
  if (kanaScroll) {
    if (isEnglish(text)) {
      kanaScroll.style.display = "none";
    } else {
      kanaScroll.style.display = "block";

      const DISPLAY_LEN = 40;
      const CENTER_POS = Math.floor(DISPLAY_LEN / 2);

      // ★改行と、改行直後のスペースを1文字スペースに統一 (ローマ字表示とロジックを統一)
      const cleanedText = text.replace(/(\r?\n[ 　]*)+/g, ' ');
      const textIndexMap = [];
      let cleanedTextIndex = 0;
      let inNewlineGroup = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '\r') continue;
        if (char === '\n') {
          if (!inNewlineGroup) {
            textIndexMap[i] = cleanedTextIndex;
            cleanedTextIndex += 1;
            inNewlineGroup = true;
          } else {
            textIndexMap[i] = cleanedTextIndex - 1;
          }
          continue;
        }

        if (inNewlineGroup && (char === ' ' || char === '　')) {
          textIndexMap[i] = -1;
          continue;
        }

        inNewlineGroup = false;
        textIndexMap[i] = cleanedTextIndex;
        cleanedTextIndex += 1;
      }

      const chars = cleanedText.split("").map((c, i) => ({ char: c, index: i }));

      const getVisiblePos = position => {
        if (position >= textIndexMap.length) return cleanedTextIndex;
        const mapped = textIndexMap[position];
        if (mapped !== -1) return mapped;

        for (let j = position + 1; j < textIndexMap.length; j++) {
          if (textIndexMap[j] !== -1) return textIndexMap[j];
        }
        return cleanedTextIndex;
      };

      const visiblePos = getVisiblePos(pos);
      const safePos = visiblePos === -1 ? chars.length : visiblePos;

      let start = Math.max(safePos - CENTER_POS, 0);

      const visibleKana = chars.slice(start, start + DISPLAY_LEN);

      kanaScroll.innerHTML = "";
      for (let i = 0; i < visibleKana.length; i++) {
        const span = document.createElement("span");

        span.textContent = visibleKana[i].char;

        // visibleKanaのi番目の要素は、元のchars配列では start + i 番目にあたる
        const originalCharIndexInChars = start + i;

        if (originalCharIndexInChars < safePos) {
          span.className = "done";
        } else if (originalCharIndexInChars === safePos) {
          span.className = "current";
        }

        kanaScroll.appendChild(span);
      }
    }
  }

  // --- ローマ字表示 ---
  const romaScroll = dom.romaScroll();

  if (romaScroll) {
    const DISPLAY_LEN = 40;
    const CENTER_POS = Math.floor(DISPLAY_LEN / 2);

    const displayFull = getDisplayFullRoma({ text, pos, typed, inputedRomaji });


    // ★改行と、改行直後のスペースを1文字スペースに統一
    const cleanedRoma = displayFull.replace(/(\r?\n[ 　]*)+/g, ' ');
    const romaMap = cleanedRoma.split("").map((c, i) => ({ char: c, index: i }));

    const typedLen = inputedRomaji.length + typed.length;

    const safePos = Math.min(typedLen, romaMap.length);

    let start;
    if (safePos + CENTER_POS >= romaMap.length) {
      start = Math.max(romaMap.length - DISPLAY_LEN, 0);
    } else {
      start = Math.max(safePos - CENTER_POS, 0);
    }

    const visibleRoma = romaMap.slice(start, start + DISPLAY_LEN);
    const relativeTyped = typedLen - start;

    romaScroll.innerHTML = "";
    for (let i = 0; i < visibleRoma.length; i++) {
      const s = document.createElement("span");
      const char = visibleRoma[i].char;
      if (char === ' ') {
        s.textContent = '␣';
        s.classList.add('space-char');
      } else {
        s.textContent = char;
      }

      if (i < safePos - start) s.classList.add("done");
      romaScroll.appendChild(s);
    }
  }
}

function renderNormal({ text, pos, typed, inputedRomaji }) {
const jpDiv = dom.jp();
if (jpDiv) {
   if (isEnglish(text)) {
     jpDiv.style.display = "none";
   } else {
    jpDiv.style.display = "inline-block";

  const done = text.slice(0, pos);
  const remain = text.slice(pos);
  jpDiv.innerHTML = `<span class="done">${done}</span>${remain}`;
}
}

const romaDiv = dom.roma();
if (romaDiv) {
  const displayFull = getDisplayFullRoma({ text, pos, typed, inputedRomaji });
  const typedLen = inputedRomaji.length + typed.length;

  if (displayFull !== lastRomaText || typedLen !== lastTypedLen) {
    lastRomaText = displayFull;
    lastTypedLen = typedLen;

    romaDiv.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (let j = 0; j < displayFull.length; j++) {
      const s = document.createElement("span");
      const char = displayFull[j];
      if (char === ' ') {
        s.textContent = '␣';
        s.classList.add('space-char');
      } else {
        s.textContent = char;
      }
      if (j < typedLen) s.className = "done";
      fragment.appendChild(s);
    }
    romaDiv.appendChild(fragment);
  }
}
}

function renderStats({ correctCount, mistakeCount }) {
const statsDiv = dom.stats();
if (!statsDiv) return;

const total = correctCount + mistakeCount;
const accuracy = total === 0 ? 100 : Math.round((correctCount / total) * 100);
statsDiv.innerHTML = `正タイプ数: ${correctCount}　ミスタイプ数: ${mistakeCount}　正確性: ${accuracy}%`;
}

/* =====================================================
  ゲーム中のフリーモード表示
  ===================================================== */
function renderFreeModeBadge(isFreeMode) {
  const badge = dom.freeModeBadge();
  if (!badge) return;

  badge.style.display = isFreeMode ? "block" : "none";
}

/* =====================================================
  ゲーム中のミスモード表示
  ===================================================== */
function renderMissModeBadge(isMissPractice) {
  const badge = dom.missModeBadge();

  if (!badge) return;
  badge.style.display = isMissPractice ? "block" : "none";


}

/**
 * 現在再生中のBGM情報を表示する
 * @param {number} now - 現在のタイムスタンプ
 */
function renderBgmInfo(now) {
    const info = gameState.currentBgmInfo;
    const displayEl = dom.bgmInfoDisplay();

    if (!displayEl) return;
    // startTimeがリセットされている場合も非表示
    if (!info || !gameState.startTime || gameState.startTime === 0) {
        displayEl.style.opacity = "0";
        return;
    }

    // Update text content
    displayEl.textContent = `♪ ${info.title} / ${info.composer}`;

    // Fade in/out logic
    const fadeDuration = 2000;
    const displayDuration = 15000; // Display duration
    const elapsed = now - (gameState.startTime || 0); // Use gameState.startTime

    let alpha = 0;
    if (elapsed < fadeDuration) {
        alpha = elapsed / fadeDuration; // Fade in
    } else if (elapsed < displayDuration - fadeDuration) {
        alpha = 1; // Stay
    } else if (elapsed < displayDuration) {
        alpha = (displayDuration - elapsed) / fadeDuration; // Fade out
    }

    displayEl.style.opacity = Math.max(0, alpha).toString();
}