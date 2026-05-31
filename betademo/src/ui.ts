import type { GameState, GameResult, NoodleBoss, ReportKind } from "./game/types";
import { getCampaignTop, getMinuteTop, getTop } from "./game/leaderboard";
import { renderQrToCanvas } from "./qr";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

export class UI {
  private tempBar = $("temp-bar");
  private tempVal = $("temp-val");
  private tempTarget = $<HTMLElement>("temp-target");
  private noodleBar = $("noodle-bar");
  private noodleVal = $("noodle-val");
  private comboBar = $("combo-bar");
  private comboVal = $("combo-val");
  private comboBadge = $("combo-badge");
  private timerLabel = $("timer-label");
  private timerVal = $("timer-val");
  private expVal = $("exp-val");
  private modeVal = $("mode-val");
  private bowlsLabel = $("bowls-label");
  private bowlsVal = $("bowls-val");
  private bossName = $("boss-name");
  private bossJob = $("boss-job");
  private bossHeat = $("boss-heat");
  private bossLen = $("boss-len");
  private bossTough = $("boss-tough");
  private bossExp = $("boss-exp");
  private phaseBanner = $("phase-banner");
  private battleCountdown = $("battle-countdown");
  private readyFlash = $("ready-flash");
  private reportLog = $<HTMLUListElement>("report-log");
  private signal = $("signal");
  private signalText = $("signal-text");
  private blowMeter = $("blow-meter");
  private openMeter = $("open-meter");
  private playerName = $("player-name");
  private playerJob = $("player-job");
  private armyName = $("army-name");
  private armyRank = $("army-rank");
  private resultFace = $("result-face");
  private resultSnap = $<HTMLCanvasElement>("result-snap");
  private shareArt = $<HTMLCanvasElement>("share-art");
  private currentPlayerName = "Beta";
  private hasResultSnap = false;
  private reportCount = 0;

  constructor() {
    // place the 35℃ target marker on the temperature gauge
    // gauge fill maps temperature 0..100 -> width; 35 sits at 35%.
    this.tempTarget.style.left = "35%";
  }

  sync(s: GameState) {
    // temperature: 100 -> target. bar width = temp%
    this.tempBar.style.width = `${s.temperature}%`;
    this.tempVal.textContent = `${Math.round(s.temperature)}℃`;
    this.noodleBar.style.width = `${s.noodle}%`;
    this.noodleVal.textContent = `${Math.round(s.noodle)}%`;

    this.comboBar.style.width = `${Math.min(100, s.combo * 4)}%`;
    this.comboVal.textContent = `${s.combo}`;

    if (s.combo >= 2) {
      this.comboBadge.classList.remove("hidden");
      this.comboBadge.textContent = `COMBO x${s.combo}`;
    } else {
      this.comboBadge.classList.add("hidden");
    }

    if (s.mode === "minute") {
      const remaining = Math.ceil(Math.max(0, (s.timeLimit ?? 60) - s.elapsed));
      this.timerLabel.textContent = "倒计时";
      this.timerVal.textContent = `${remaining}`;
      this.battleCountdown.textContent = formatClock(remaining);
      this.battleCountdown.classList.toggle("hidden", s.phase === "win");
    } else if (s.mode === "campaign") {
      this.timerLabel.textContent = "本关";
      this.timerVal.textContent = s.elapsed.toFixed(2);
      this.battleCountdown.classList.add("hidden");
    } else {
      this.timerLabel.textContent = "计时";
      this.timerVal.textContent = s.elapsed.toFixed(2);
      this.battleCountdown.classList.add("hidden");
    }
    this.modeVal.textContent =
      s.mode === "minute" ? "限时" : s.mode === "campaign" ? "征战" : "一碗";
    this.bowlsLabel.textContent = s.mode === "campaign" ? "关卡" : "碗数";
    this.bowlsVal.textContent =
      s.mode === "campaign" && s.totalStages > 0
        ? `${s.campaignStage}/${s.totalStages}`
        : `${s.bowls}`;
    this.expVal.textContent = `${Math.round(s.exp)}`;
    this.bossHeat.textContent = `${Math.round(s.temperature)}`;
    this.bossLen.textContent = `${Math.round(s.noodle)}`;
  }

  setMeters(blow: number, suck: number, phase: GameState["phase"]) {
    const activeBlow = phase === "blow" ? blow : 0;
    const activeSuck = phase === "suck" ? suck : 0;
    this.blowMeter.style.width = `${Math.round(activeBlow * 100)}%`;
    this.openMeter.style.width = `${Math.round(activeSuck * 100)}%`;
  }

  setSignal(live: boolean, text: string) {
    this.signal.classList.toggle("live", live);
    this.signalText.textContent = text;
  }

  setBoss(boss: NoodleBoss) {
    this.bossName.textContent = boss.name;
    this.bossJob.textContent = `${boss.title} · Lv.${boss.level}`;
    this.bossTough.textContent = `${boss.toughness}`;
    this.bossExp.textContent = `${boss.exp}`;
  }

  setPlayerName(name: string) {
    this.currentPlayerName = name;
    if (document.activeElement !== this.playerName) {
      this.playerName.textContent = name;
    }
    this.armyName.textContent = `玩家：${name}`;
  }

  setCampaignRankText(clearedStages: number, totalStages: number) {
    const active = totalStages > 0;
    const rank = Math.max(0, Math.min(5, clearedStages));
    const titles = ["初阵布甲", "赤铜肩甲", "青缎战袍", "金纹将铠", "赤焰披风", "泡面大将军"];

    this.playerJob.textContent = active ? `${titles[rank]} · Lv.${6 + rank}` : "吹面骑兵 · Lv.6";
    this.armyRank.textContent = active ? `Lv.${6 + rank} ${titles[rank]}` : "Lv.6 吹面骑兵";
  }

  setPhase(phase: GameState["phase"]) {
    if (phase === "blow") {
      this.phaseBanner.textContent = "吹 凉 泡 面";
      this.phaseBanner.classList.remove("hidden");
      this.readyFlash.classList.add("hidden");
    } else if (phase === "suck") {
      this.phaseBanner.textContent = "吸 面 时 间";
      this.readyFlash.classList.remove("hidden");
      window.setTimeout(() => this.readyFlash.classList.add("hidden"), 1400);
    } else {
      this.phaseBanner.classList.add("hidden");
      this.battleCountdown.classList.add("hidden");
    }
  }

  pushReport(text: string, kind: ReportKind) {
    const li = document.createElement("li");
    li.className = kind;
    li.textContent = text;
    this.reportLog.appendChild(li);
    this.reportCount++;
    while (this.reportLog.children.length > 24) {
      this.reportLog.removeChild(this.reportLog.firstChild!);
    }
    requestAnimationFrame(() => {
      this.reportLog.scrollTop = this.reportLog.scrollHeight;
    });
  }

  clearReport() {
    this.reportLog.innerHTML = "";
    this.reportLog.scrollTop = 0;
    this.reportCount = 0;
  }

  captureResultFace(video: HTMLVideoElement) {
    this.hasResultSnap = drawVideoToCanvas(video, this.resultSnap);
    this.resultFace.classList.toggle("hidden", !this.hasResultSnap);
  }

  showResult(r: GameResult) {
    const isMinute = r.mode === "minute";
    const isCampaign = r.mode === "campaign";
    $("result-title").textContent = isMinute ? "限 時" : isCampaign ? "封 將" : "勝 利";
    $("again-btn").textContent = isMinute ? "再 战 一 分" : isCampaign ? "再 征 五 关" : "再 来 一 碗";
    $("r-time-label").textContent = isMinute ? "挑战时长" : isCampaign ? "总用时" : "完成时间";
    $("r-time").textContent = isMinute ? "60 秒" : `${r.time.toFixed(2)} 秒`;
    $("r-rank-label").textContent = isMinute ? "吃完碗数" : isCampaign ? "通关进度" : "世界排名";
    $("r-rank").textContent = isMinute
      ? `${r.bowls} 碗`
      : isCampaign
        ? `${r.stagesCleared}/${r.totalStages} 关`
        : `#${r.rank.toLocaleString()}`;
    $("r-grade").textContent = r.grade;
    $("r-combo").textContent = `x${r.maxCombo}`;

    const list = $<HTMLOListElement>("lb-list");
    list.innerHTML = "";
    $("lb-title").textContent = isMinute
      ? "一 分 鐘 排 行"
      : isCampaign
        ? "征 戰 排 行"
        : "本 地 排 行 榜";
    if (isMinute) {
      for (const e of getMinuteTop(8)) {
        const li = document.createElement("li");
        const isMe = e.bowls === r.bowls && e.maxCombo === r.maxCombo && e.name === r.name;
        if (isMe) li.className = "me";
        li.innerHTML = `<span>${e.name}</span><b>${e.bowls}碗</b>`;
        list.appendChild(li);
      }
    } else if (isCampaign) {
      for (const e of getCampaignTop(8)) {
        const li = document.createElement("li");
        const isMe =
          e.stagesCleared === r.stagesCleared &&
          e.maxCombo === r.maxCombo &&
          e.name === r.name;
        if (isMe) li.className = "me";
        li.innerHTML = `<span>${e.name}</span><b>${e.stagesCleared}关</b>`;
        list.appendChild(li);
      }
    } else {
      for (const e of getTop(8)) {
        const li = document.createElement("li");
        const isMe = Math.abs(e.time - r.time) < 0.001 && e.name === r.name;
        if (isMe) li.className = "me";
        li.innerHTML = `<span>${e.name}</span><b>${e.time.toFixed(2)}s</b>`;
        list.appendChild(li);
      }
    }
    show("result");
  }

  showShare(r: GameResult, snapFrom?: HTMLVideoElement) {
    // Reuse the victory freeze-frame so the share card matches the result screen.
    if (!this.hasResultSnap && snapFrom) this.hasResultSnap = drawVideoToCanvas(snapFrom, this.resultSnap);
    this.renderShareImage(r, this.shareArt);
    hide("result");
    show("share");
  }

  downloadShareImage(r: GameResult) {
    const canvas = this.renderShareImage(r, this.shareArt);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `paomian-jiangjun-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private renderShareImage(r: GameResult, target?: HTMLCanvasElement) {
    const canvas = target ?? document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d")!;
    const url = shareUrl();
    const lines = shareLines(r);
    const cnFont = `"STKaiti", "Kaiti SC", "KaiTi", "Songti SC", serif`;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawParchmentPanel(ctx, 34, 26, 832, 1228);

    drawCenteredText(ctx, shareTitle(r), 450, 108, `58px ${cnFont}`, "#d8392b");
    drawCenteredText(ctx, "VICTORY", 450, 158, `24px ${cnFont}`, "#e49426");
    drawCenteredText(ctx, "━━━━━━━━━━━━", 450, 202, `16px ${cnFont}`, "#e49426");

    const faceX = 300;
    const faceY = 235;
    const faceSize = 300;
    ctx.fillStyle = "rgba(42,29,12,0.14)";
    ctx.fillRect(faceX - 18, faceY - 18, faceSize + 36, faceSize + 36);
    ctx.fillStyle = "#05080f";
    ctx.fillRect(faceX - 8, faceY - 8, faceSize + 16, faceSize + 16);
    ctx.strokeStyle = "#6e9ad7";
    ctx.lineWidth = 8;
    ctx.strokeRect(faceX - 12, faceY - 12, faceSize + 24, faceSize + 24);
    ctx.strokeStyle = "#9c8956";
    ctx.lineWidth = 4;
    ctx.strokeRect(faceX - 20, faceY - 20, faceSize + 40, faceSize + 40);
    if (this.hasResultSnap) {
      ctx.save();
      ctx.translate(faceX + faceSize, faceY);
      ctx.scale(-1, 1);
      ctx.drawImage(this.resultSnap, 0, 0, faceSize, faceSize);
      ctx.restore();
    } else {
      drawCenteredText(ctx, "定 格 表 情", 450, faceY + 120, `28px ${cnFont}`, "#4b3210");
    }
    if (isCampaignConquered(r)) drawGeneralCrown(ctx, faceX, faceY, faceSize);

    let y = 610;
    for (const line of lines) {
      drawStatRow(ctx, 88, y - 32, 724);
      drawText(ctx, line.label, 112, y, `32px ${cnFont}`, "#34250d");
      drawRightText(ctx, line.value, 782, y, `34px ${cnFont}`, line.hot ? "#8e1515" : "#4b3210");
      y += 80;
    }
    drawStatRow(ctx, 88, y - 32, 724);

    drawCenteredText(ctx, "你 敢 挑 战 吗 ？", 450, 940, `34px ${cnFont}`, "#d8392b", 1, "#8e1515");

    const qrCanvas = document.createElement("canvas");
    qrCanvas.width = 200;
    qrCanvas.height = 200;
    renderQrToCanvas(url, qrCanvas);
    ctx.fillStyle = "rgba(42,29,12,0.14)";
    ctx.fillRect(338, 980, 224, 178);
    ctx.fillStyle = "#f7edd0";
    ctx.fillRect(362, 989, 176, 176);
    ctx.drawImage(qrCanvas, 362, 989, 176, 176);
    drawCenteredText(ctx, "扫 码 出 征", 450, 1208, `26px ${cnFont}`, "#34250d");
    return canvas;
  }
}

export function show(id: string) {
  $(id).classList.remove("hidden");
}
export function hide(id: string) {
  $(id).classList.add("hidden");
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.min(5999, seconds));
  const mm = Math.floor(safe / 60).toString().padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

const FALLBACK_SHARE_URL = "https://betagg.github.io/NOODLE-GENERAL/";

function shareUrl() {
  try {
    const url = new URL(window.location.href);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return FALLBACK_SHARE_URL;
    url.hash = "";
    url.search = "";
    return qrSafeUrl(url.href || FALLBACK_SHARE_URL);
  } catch {
    return FALLBACK_SHARE_URL;
  }
}

function qrSafeUrl(url: string) {
  return new TextEncoder().encode(url).length <= 74 ? url : FALLBACK_SHARE_URL;
}

function shareTitle(r: GameResult) {
  if (r.mode === "minute") return "限 時";
  if (r.mode === "campaign") return "封 將";
  return "勝 利";
}

function shareLines(r: GameResult) {
  if (r.mode === "minute") {
    return [
      { label: "挑战时长", value: "60 秒" },
      { label: "吃完碗数", value: `${r.bowls} 碗`, hot: true },
      { label: "击败玩家", value: `${r.beatPct}%` },
      { label: "获得称号", value: r.grade, hot: true },
    ];
  }
  if (r.mode === "campaign") {
    return [
      { label: "总用时", value: `${r.time.toFixed(2)} 秒` },
      { label: "通关进度", value: `${r.stagesCleared}/${r.totalStages} 关`, hot: true },
      { label: "击败玩家", value: `${r.beatPct}%` },
      { label: "获得称号", value: r.grade, hot: true },
    ];
  }
  return [
    { label: "完成时间", value: `${r.time.toFixed(2)} 秒` },
    { label: "世界排名", value: `#${r.rank.toLocaleString()}`, hot: true },
    { label: "击败玩家", value: `${r.beatPct}%` },
    { label: "获得称号", value: r.grade, hot: true },
  ];
}

function isCampaignConquered(r: GameResult) {
  return r.mode === "campaign" && r.totalStages > 0 && r.stagesCleared >= r.totalStages;
}

function drawParchmentPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, "#efe2b9");
  gradient.addColorStop(1, "#d8c68e");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  for (let lineY = y + 6; lineY < y + h; lineY += 7) {
    ctx.fillStyle = lineY % 14 === 0 ? "rgba(95,78,45,0.28)" : "rgba(255,255,255,0.22)";
    ctx.fillRect(x, lineY, w, 2);
  }

  ctx.strokeStyle = "#fff6dd";
  ctx.lineWidth = 7;
  ctx.strokeRect(x + 13, y + 13, w - 26, h - 26);
  ctx.strokeStyle = "#9c8956";
  ctx.lineWidth = 7;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.strokeStyle = "#6e9ad7";
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 22, y + 22, w - 44, h - 44);
}

function drawStatRow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ctx.strokeStyle = "rgba(60,40,10,0.28)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, fill: string) {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRightText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, fill: string) {
  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawGeneralCrown(ctx: CanvasRenderingContext2D, faceX: number, faceY: number, faceSize: number) {
  const unit = faceSize / 260;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(faceX + x * unit),
      Math.round(faceY + y * unit),
      Math.round(w * unit),
      Math.round(h * unit),
    );
  };

  rect(36, 6, 188, 22, "#3c0806");
  rect(52, -14, 32, 56, "#151006");
  rect(114, -22, 32, 70, "#151006");
  rect(176, -14, 32, 56, "#151006");
  rect(48, -8, 28, 52, "#ffd03d");
  rect(82, 6, 34, 34, "#f3a72a");
  rect(110, -16, 40, 64, "#ffd03d");
  rect(150, 6, 34, 34, "#f3a72a");
  rect(188, -8, 28, 52, "#ffd03d");

  rect(24, 26, 212, 18, "#151006");
  rect(30, 20, 200, 34, "#d8392b");
  rect(38, 25, 184, 8, "#ff6850");
  rect(54, 54, 152, 38, "#7f1414");
  rect(62, 58, 136, 12, "#d8392b");
  rect(104, 52, 52, 42, "#f3a72a");
  rect(114, 58, 32, 26, "#ffd03d");
  rect(123, 65, 14, 12, "#fff0a6");

  rect(0, 46, 44, 20, "#151006");
  rect(216, 46, 44, 20, "#151006");
  rect(6, 42, 44, 16, "#ffd03d");
  rect(210, 42, 44, 16, "#ffd03d");
  rect(12, 58, 24, 36, "#8e1515");
  rect(224, 58, 24, 36, "#8e1515");
  rect(18, 60, 12, 26, "#d8392b");
  rect(230, 60, 12, 26, "#d8392b");
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  fill: string,
  shadowBlur = 0,
  shadowColor = "transparent",
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowColor = shadowColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawVideoToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  if (!video.videoWidth || !video.videoHeight) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const sourceSize = Math.min(video.videoWidth, video.videoHeight);
  const sx = Math.max(0, (video.videoWidth - sourceSize) / 2);
  const sy = Math.max(0, (video.videoHeight - sourceSize) / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  try {
    ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);
    return true;
  } catch {
    return false;
  }
}
