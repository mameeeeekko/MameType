// onlineRankingRenderer.js

import { getRanking } from "./getRanking.js";
import { getPlayerId, isOnlineEnabled } from "../online/playerProfile.js";
import { loadRecords } from "../js/storage.js";

let currentMode = "normal";
let currentOffset = 0;
let hasMore = true;
const PAGE_SIZE = 50;

export async function openOnlineRanking() {

  const screen = document.getElementById("onlineRankingScreen");
  if (screen) {
    screen.classList.remove("hidden");
    screen.style.display = "block"; // 念のため
  }

  currentMode = "normal";
  currentOffset = 0;

  await renderRanking(true);
  bindRankingEvents();
}

async function renderRanking(reset = false) {
  const list = document.getElementById("rankingList");
  const myRankEl = document.getElementById("myOnlineRank");
  if (!list) return;

  try {
    const ranking = await getRanking(
      currentMode,
      currentOffset,
      currentOffset + PAGE_SIZE - 1
    );

    // ★ 自分の順位を計算して表示
    await renderMyRank(myRankEl, ranking, currentMode);

    if (!ranking || ranking.length === 0) {
        list.innerHTML = "<p>No ranking data</p>";
        hasMore = false;
        return;
    }



    if (ranking.length < PAGE_SIZE) {
        hasMore = false;
    }

    const myPlayerId = getPlayerId();
    const html = ranking.map((row, i) => {
      const isMyRank = row.player_id === myPlayerId;
      const myRankClass = isMyRank ? 'my-rank' : '';
      return `
      <div class="rank-row ${myRankClass}">
        <span>${currentOffset + i + 1}</span>
        <span>${row.player_name}</span>
        <span>
            ${
                currentMode === "time_attack"
                ? row.solved_count
                : row.score
            }
        </span>
      </div>
    `}).join("");

    if (reset) {
      list.innerHTML = html;
    } else {
      list.insertAdjacentHTML("beforeend", html);
    }

  } catch (e) {
    console.error("renderRanking error:", e);
    list.innerHTML = "<p>Ranking load failed</p>";
  }

}

/**
 * ★ 自分の現在の順位を計算して表示する
 * @param {HTMLElement} el - 表示先の要素
 * @param {Array} onlineRanking - オンラインランキングのデータ
 * @param {string} mode - 現在のゲームモード
 */
async function renderMyRank(el, onlineRanking, mode) {
  if (!el) return;

  // if (!isOnlineEnabled()) {
  //   el.innerHTML = "オンラインランキングは無効です";
  //   return;
  // }

  // 3. オンラインランキングから自分のplayerIDを探して順位を特定
  const myPlayerId = getPlayerId();
  const rankIndex = onlineRanking.findIndex(r => r.player_id === myPlayerId);
  const rank = rankIndex !== -1 ? rankIndex + 1 : -1;

  if (rank === -1) {
    el.innerHTML = "RANK: <span class='my-rank-position'>ランク外</span>";
  } else {
    el.innerHTML = `RANK: <span class="my-rank-position">${rank}位</span>`;
  }

}

function bindRankingEvents() {
    // タブ切替
    document.querySelectorAll(".ranking-tab").forEach(btn => {
        btn.onclick = async () => {
        document.querySelectorAll(".ranking-tab")
            .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        currentMode = btn.dataset.mode;
        currentOffset = 0;

        hasMore = true; // ★追加
        await renderRanking(true);
        };
    });
    
    // スクロール更新
    const list = document.getElementById("rankingList");

    let loading = false;

    list.onscroll = async () => {
        if (loading || !hasMore) return;

        const threshold = 100;

        if (list.scrollTop + list.clientHeight >= list.scrollHeight - threshold) {
            loading = true;

            currentOffset += PAGE_SIZE;
            await renderRanking(false);

            loading = false;
        }
    };
}