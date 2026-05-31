import type { GameState } from "../game/types";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
}

const W = 640;
const H = 360;

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private bossCtx: CanvasRenderingContext2D | null;
  private t = 0;
  private steam: Particle[] = [];
  private gust: Particle[] = [];
  private steamAcc = 0;
  private shake = 0;

  constructor(canvas: HTMLCanvasElement, bossCanvas?: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.bossCtx = bossCanvas?.getContext("2d") ?? null;
    if (this.bossCtx) this.bossCtx.imageSmoothingEnabled = false;
  }

  hit() {
    this.shake = 6;
  }

  update(dt: number, s: GameState) {
    this.t += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    // steam emission scales with temperature
    const heat = (s.temperature - s.targetTemp) / (100 - s.targetTemp);
    this.steamAcc += dt * (4 + heat * 28);
    while (this.steamAcc >= 1 && s.phase !== "win") {
      this.steamAcc -= 1;
      this.steam.push({
        x: 470 + (Math.random() - 0.5) * 70,
        y: 210,
        vx: (Math.random() - 0.5) * 8,
        vy: -28 - Math.random() * 22,
        life: 0,
        max: 1.6 + Math.random() * 1.2,
        size: 6 + Math.random() * 6,
      });
    }

    const blowing = s.phase === "blow" && s.acting;
    for (const p of this.steam) {
      p.life += dt;
      p.x += p.vx * dt + (blowing ? s.blow * 90 * dt : 0); // wind pushes steam right
      p.y += p.vy * dt;
      p.vy *= 0.99;
    }
    this.steam = this.steam.filter((p) => p.life < p.max);

    // wind gust particles while blowing
    if (blowing) {
      if (Math.random() < 0.6) {
        this.gust.push({
          x: 180,
          y: 235 + (Math.random() - 0.5) * 40,
          vx: 160 + Math.random() * 120,
          vy: (Math.random() - 0.5) * 30,
          life: 0,
          max: 1.0,
          size: 3 + Math.random() * 3,
        });
      }
    }
    for (const g of this.gust) {
      g.life += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
    }
    this.gust = this.gust.filter((g) => g.life < g.max && g.x < 560);
  }

  render(s: GameState) {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    }
    this.drawBackground();
    this.drawGust();
    this.drawPlayer(s);
    this.drawBowl(s, ctx, 400, 150, 1);
    this.drawSteam();
    this.drawNoodleStrands(s);
    this.drawFloatTemp(s);
    ctx.restore();

    if (this.bossCtx) this.drawBossMini(s);
  }

  // ---------------------------------------------------------
  private drawBackground() {
    const ctx = this.ctx;
    // sky / war-tent gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#243a5e");
    g.addColorStop(0.55, "#172741");
    g.addColorStop(1, "#0c1426");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // floor
    ctx.fillStyle = "#3a2a18";
    ctx.fillRect(0, 300, W, H - 300);
    ctx.fillStyle = "#4a3520";
    for (let x = 0; x < W; x += 32) ctx.fillRect(x, 300, 16, 6);

    // distant banner poles
    ctx.fillStyle = "rgba(216,57,43,0.5)";
    ctx.fillRect(60, 70, 8, 220);
    ctx.fillRect(572, 70, 8, 220);
    ctx.fillStyle = "rgba(216,57,43,0.75)";
    const wav = Math.sin(this.t * 2) * 3;
    ctx.fillRect(68, 70, 40, 60 + wav);
    ctx.fillRect(532, 70, 40, 60 - wav);

    // grid haze near floor
    ctx.fillStyle = "rgba(255,210,74,0.04)";
    for (let y = 304; y < H; y += 8) ctx.fillRect(0, y, W, 2);
  }

  private drawGust() {
    const ctx = this.ctx;
    for (const g of this.gust) {
      const a = 1 - g.life / g.max;
      ctx.fillStyle = `rgba(180,225,255,${a * 0.7})`;
      ctx.fillRect(Math.round(g.x), Math.round(g.y), 14, g.size);
    }
  }

  private drawSteam() {
    const ctx = this.ctx;
    for (const p of this.steam) {
      const a = (1 - p.life / p.max) * 0.5;
      const sz = p.size + p.life * 4;
      ctx.fillStyle = `rgba(245,245,255,${a})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
  }

  // 吹面骑兵 — left fighter
  private drawPlayer(s: GameState) {
    const ctx = this.ctx;
    const px = 96;
    const py = 188;
    const puff = s.phase === "blow" ? s.blow : 0;
    const bob = Math.sin(this.t * 4) * 2;
    const outfitRank =
      s.mode === "campaign" && s.totalStages > 0
        ? Math.max(0, Math.min(5, s.campaignStage - 1))
        : 0;
    const outfit = playerOutfit(outfitRank);

    // body / armor (cyan-blue knight)
    rect(ctx, px + 8, py + 56 + bob, 60, 56, outfit.body);
    rect(ctx, px + 8, py + 56 + bob, 60, 10, outfit.bodyHi);
    rect(ctx, px + 16, py + 70 + bob, 44, 30, outfit.bodyShadow);
    // belt
    rect(ctx, px + 8, py + 96 + bob, 60, 8, outfit.trim);

    if (outfitRank >= 1) {
      rect(ctx, px - 2, py + 58 + bob, 18, 22, outfit.trim);
      rect(ctx, px + 60, py + 58 + bob, 18, 22, outfit.trim);
      rect(ctx, px, py + 60 + bob, 14, 6, outfit.trimHi);
      rect(ctx, px + 62, py + 60 + bob, 14, 6, outfit.trimHi);
    }
    if (outfitRank >= 2) {
      rect(ctx, px + 10, py + 66 + bob, 56, 6, outfit.trimHi);
      rect(ctx, px + 20, py + 78 + bob, 36, 5, outfit.trimHi);
    }
    if (outfitRank >= 4) {
      rect(ctx, px - 16, py + 66 + bob, 18, 64, "rgba(140,29,24,0.88)");
      rect(ctx, px + 74, py + 66 + bob, 18, 64, "rgba(140,29,24,0.88)");
      rect(ctx, px - 16, py + 66 + bob, 108, 8, "rgba(216,57,43,0.88)");
    }

    // head
    rect(ctx, px + 16, py + 18 + bob, 44, 42, "#f0c79a");
    // helmet
    rect(ctx, px + 12, py + 6 + bob, 52, 18, outfit.helmet);
    rect(ctx, px + 12, py + 6 + bob, 52, 6, outfit.helmetHi);
    if (outfitRank >= 3) {
      rect(ctx, px + 6, py + 12 + bob, 12, 8, outfit.trim);
      rect(ctx, px + 58, py + 12 + bob, 12, 8, outfit.trim);
    }
    rect(ctx, px + 34, py - 6 + bob, 8, 14, outfit.plume); // plume
    if (outfitRank >= 5) {
      rect(ctx, px + 28, py - 12 + bob, 20, 8, outfit.trimHi);
      rect(ctx, px + 24, py - 8 + bob, 6, 6, outfit.trimHi);
      rect(ctx, px + 46, py - 8 + bob, 6, 6, outfit.trimHi);
    }

    // eyes — focused
    rect(ctx, px + 24, py + 30 + bob, 7, 7, "#1a1a1a");
    rect(ctx, px + 44, py + 30 + bob, 7, 7, "#1a1a1a");
    // brow when blowing hard
    if (puff > 0.4) {
      rect(ctx, px + 22, py + 26 + bob, 11, 3, "#5a3010");
      rect(ctx, px + 42, py + 26 + bob, 11, 3, "#5a3010");
    }

    // cheeks puff
    const cheek = 4 + puff * 10;
    rect(ctx, px + 12 - cheek * 0.4, py + 38 + bob, cheek, cheek, "#f7b3a0");
    rect(ctx, px + 52, py + 38 + bob, cheek, cheek, "#f7b3a0");

    // mouth: pulse O when blowing, smaller rounded lips when sucking, line otherwise
    if (s.phase === "blow" && puff > 0.18) {
      const o = 6 + puff * 8;
      rect(ctx, px + 38 - o / 2, py + 44 + bob, o, o, "#7a1f12");
    } else if (s.phase === "suck") {
      const o = 5 + s.suck * 9;
      rect(ctx, px + 38 - o / 2, py + 44 + bob, o, o, "#7a1f12");
      rect(ctx, px + 38 - o / 2 + 2, py + 46 + bob, Math.max(2, o - 4), 3, "#d8392b");
    } else {
      rect(ctx, px + 33, py + 48 + bob, 12, 4, "#7a1f12");
    }
  }

  // The ramen boss bowl. scale lets us reuse for the mini portrait.
  private drawBowl(
    s: GameState,
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    scale: number,
  ) {
    const u = (n: number) => Math.round(n * scale);
    const p = s.boss.palette;
    const heat = (s.temperature - s.targetTemp) / (100 - s.targetTemp);
    const breath = Math.sin(this.t * 3) * 2 * scale;

    // noodle mound on top of bowl (shrinks during suck phase)
    const noodleH = u(8 + (s.noodle / 100) * 26);
    rect(ctx, ox + u(14), oy + u(54) - noodleH + breath, u(132), noodleH, p.noodle);
    rect(ctx, ox + u(14), oy + u(54) - noodleH + breath, u(132), u(5), p.noodleHi);
    // noodle squiggles
    ctx.fillStyle = p.strand;
    for (let i = 0; i < 6; i++) {
      const nx = ox + u(22 + i * 20);
      rect(ctx, nx, oy + u(50) - noodleH + breath, u(4), noodleH, p.strand);
    }
    // toppings
    rect(ctx, ox + u(28), oy + u(48) - noodleH + breath, u(18), u(10), p.meat); // beef
    rect(ctx, ox + u(96), oy + u(48) - noodleH + breath, u(18), u(10), p.meat);
    rect(ctx, ox + u(64), oy + u(46) - noodleH + breath, u(14), u(14), "#e9e4cf"); // egg
    rect(ctx, ox + u(67), oy + u(49) - noodleH + breath, u(8), u(8), "#ffb43a");
    rect(ctx, ox + u(46), oy + u(50) - noodleH + breath, u(10), u(6), p.garnish); // scallion
    rect(ctx, ox + u(78), oy + u(42) - noodleH + breath, u(18), u(5), p.accent);
    rect(ctx, ox + u(116), oy + u(50) - noodleH + breath, u(12), u(5), p.accent);

    // bowl body (red lacquer)
    rect(ctx, ox + u(8), oy + u(56), u(144), u(58), p.bowl);
    rect(ctx, ox + u(8), oy + u(56), u(144), u(8), p.bowlHi);
    rect(ctx, ox + u(20), oy + u(100), u(120), u(14), p.bowlShadow);
    // gold rim band
    rect(ctx, ox + u(8), oy + u(72), u(144), u(8), p.band);
    rect(ctx, ox + u(8), oy + u(72), u(144), u(3), p.bandHi);
    // bowl base
    rect(ctx, ox + u(48), oy + u(114), u(64), u(8), p.bowlShadow);

    // ---- boss face on the bowl (mood by temperature) ----
    const fy = oy + u(84);
    const fx = ox + u(80);
    // eyes
    if (heat > 0.66) {
      // angry
      rect(ctx, fx - u(34), fy - u(2), u(16), u(5), "#1a1a1a");
      rect(ctx, fx + u(18), fy - u(2), u(16), u(5), "#1a1a1a");
      rect(ctx, fx - u(30), fy - u(6), u(10), u(4), "#1a1a1a");
      rect(ctx, fx + u(20), fy - u(6), u(10), u(4), "#1a1a1a");
    } else if (heat > 0.25) {
      // worried + sweat
      rect(ctx, fx - u(30), fy - u(2), u(8), u(8), "#1a1a1a");
      rect(ctx, fx + u(22), fy - u(2), u(8), u(8), "#1a1a1a");
      rect(ctx, fx + u(34), fy - u(8) + breath, u(5), u(8), "#74d4e6"); // sweat drop
    } else {
      // dizzy / defeated-ish
      rect(ctx, fx - u(32), fy - u(2), u(10), u(3), "#1a1a1a");
      rect(ctx, fx - u(28), fy - u(6), u(3), u(10), "#1a1a1a");
      rect(ctx, fx + u(22), fy - u(2), u(10), u(3), "#1a1a1a");
      rect(ctx, fx + u(26), fy - u(6), u(3), u(10), "#1a1a1a");
    }
    // mouth
    if (heat > 0.66) rect(ctx, fx - u(10), fy + u(14), u(22), u(6), "#3a0a07");
    else rect(ctx, fx - u(8), fy + u(16), u(18), u(4), "#3a0a07");

    // chopsticks (only in blow phase / before eating)
    if (s.phase === "blow") {
      ctx.save();
      ctx.translate(ox + u(120), oy + u(20) + breath);
      ctx.rotate(-0.35);
      rect(ctx, 0, 0, u(6), u(70), "#caa06a");
      rect(ctx, u(12), 0, u(6), u(70), "#caa06a");
      ctx.restore();
    }
  }

  private drawNoodleStrands(s: GameState) {
    if (s.phase !== "suck") return;
    const ctx = this.ctx;
    const frac = s.noodle / 100;
    if (frac <= 0) return;
    // strands rising from bowl toward player's mouth (left)
    const startX = 420;
    const startY = 200;
    const endX = 134;
    const endY = 230;
    const n = 4;
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = i % 2 ? "#ffe07a" : "#f2c64e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      const sx = startX + i * 6;
      ctx.moveTo(sx, startY);
      const seg = 8;
      for (let k = 1; k <= seg; k++) {
        const tt = k / seg;
        // only draw the portion still remaining
        if (tt > frac) break;
        const x = sx + (endX - sx) * tt;
        const wob = Math.sin(this.t * 10 + i + k) * 8 * (1 - tt);
        const y = startY + (endY - startY) * tt + wob;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  private drawFloatTemp(s: GameState) {
    const ctx = this.ctx;
    ctx.font = "bold 22px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    const txt =
      s.phase === "win"
        ? "DONE"
        : s.phase === "suck"
          ? `${Math.round(s.noodle)}%`
          : `${Math.round(s.temperature)}°`;
    const color = s.phase === "blow" ? "#ff6a3d" : "#4cc081";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(txt, 472 + 2, 150 + 2);
    ctx.fillStyle = color;
    ctx.fillText(txt, 472, 150);
    ctx.textAlign = "left";
  }

  // little boss portrait in the bottom 敵將 card
  private drawBossMini(s: GameState) {
    const ctx = this.bossCtx!;
    ctx.clearRect(0, 0, 120, 120);
    ctx.fillStyle = "#1a0c06";
    ctx.fillRect(0, 0, 120, 120);
    this.drawBowl(s, ctx, -8, 8, 0.62);
  }
}

function playerOutfit(rank: number) {
  const outfits = [
    {
      body: "#2f6fb0",
      bodyHi: "#5aa0d8",
      bodyShadow: "#244e7e",
      helmet: "#c0392b",
      helmetHi: "#e0594b",
      trim: "#ffd24a",
      trimHi: "#ffe07a",
      plume: "#ffd24a",
    },
    {
      body: "#3f5f86",
      bodyHi: "#6f8fb8",
      bodyShadow: "#263f62",
      helmet: "#a0442e",
      helmetHi: "#d16b3e",
      trim: "#c28a38",
      trimHi: "#f1bf62",
      plume: "#ffd24a",
    },
    {
      body: "#245f86",
      bodyHi: "#4e9dca",
      bodyShadow: "#173f63",
      helmet: "#2f5f8f",
      helmetHi: "#69a8d8",
      trim: "#d7a84a",
      trimHi: "#ffe07a",
      plume: "#ffd24a",
    },
    {
      body: "#4b3d84",
      bodyHi: "#8172c5",
      bodyShadow: "#30285c",
      helmet: "#704c9a",
      helmetHi: "#a889d0",
      trim: "#ffd24a",
      trimHi: "#fff0bf",
      plume: "#ffbf3b",
    },
    {
      body: "#8c1d18",
      bodyHi: "#d8392b",
      bodyShadow: "#5d1114",
      helmet: "#a9241d",
      helmetHi: "#e0594b",
      trim: "#ffd24a",
      trimHi: "#fff0bf",
      plume: "#ffbf3b",
    },
    {
      body: "#7b1b23",
      bodyHi: "#e0594b",
      bodyShadow: "#4e0d16",
      helmet: "#8c1d18",
      helmetHi: "#ff6a3d",
      trim: "#ffd24a",
      trimHi: "#fff2c0",
      plume: "#fff0bf",
    },
  ];

  return outfits[Math.max(0, Math.min(outfits.length - 1, rank))];
}

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
