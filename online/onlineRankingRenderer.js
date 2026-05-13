// onlineRankingRenderer.js

import { getRanking } from "./getRanking.js";

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
  if (!list) return;

  try {
    const ranking = await getRanking(
      currentMode,
      currentOffset,
      currentOffset + PAGE_SIZE - 1
    );

    if (!ranking || ranking.length === 0) {
        list.innerHTML = "<p>No ranking data</p>";
        hasMore = false;
        return;
    }


    if (ranking.length < PAGE_SIZE) {
        hasMore = false;
    }

    const html = ranking.map((row, i) => `
      <div class="rank-row">
        <span>${currentOffset + i + 1}</span>
        <span>${row.player_name}</span>
        <span>
            ${
                currentMode === "time_attack"
                ? row.solvedCount
                : row.score
            }
        </span>
      </div>
    `).join("");

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