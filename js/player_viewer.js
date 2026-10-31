import { renderPlayer } from "./enemyRenderer.js";

const container = document.getElementById("container");
const cards = [];

for (let evo = 0; evo <= 9; evo++) {
    const card = document.createElement("div");
    card.className = "card";
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = "Lv." + (evo + 1);
    card.appendChild(canvas);
    card.appendChild(name);
    container.appendChild(card);
    cards.push({ canvas, ctx, evo });
}

function loop() {
    for (const c of cards) {
        const ctx = c.ctx;
        ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
        const player = {
            x: c.canvas.width / 2,
            y: c.canvas.height / 2,
            radius: 20,
            hp: 100,
            maxHp: 100,
            level: c.evo + 1,
        };
        renderPlayer(ctx, player, { evo: c.evo });
    }
    requestAnimationFrame(loop);
}
loop();
