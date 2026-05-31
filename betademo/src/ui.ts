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
  private shareSnap = $<HTMLCanvasElement>("share-snap");
  private shareQr = $<HTMLCanvasElement>("share-qr");
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
    if (this.hasResultSnap) copyCanvas(this.resultSnap, this.shareSnap);
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
    const isMinute = r.mode === "minute";
    const isCampaign = r.mode === "campaign";
    $("s-time").textContent = isMinute ? "60" : r.time.toFixed(2);
    $("s-bowls-label").textContent = isCampaign ? "通关" : "吃完";
    $("s-bowls").textContent = isCampaign ? `${r.stagesCleared}/${r.totalStages}` : `${r.bowls}`;
    $("s-bowls-unit").textContent = isCampaign ? "关" : "碗";
    $("s-bowl-line").classList.toggle("hidden", !isMinute && !isCampaign);
    $("s-beat").textContent = `${r.beatPct}%`;
    $("s-grade").textContent = r.grade;
    $("s-link").textContent = shareUrl();
    renderQrToCanvas(shareUrl(), this.shareQr);
    // Reuse the victory freeze-frame so the share card matches the result screen.
    if (this.hasResultSnap) {
      copyCanvas(this.resultSnap, this.shareSnap);
    } else if (snapFrom) {
      this.hasResultSnap = drawVideoToCanvas(snapFrom, this.shareSnap);
    }
    hide("result");
    show("share");
  }

  downloadShareImage(r: GameResult) {
    const canvas = this.renderShareImage(r);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `paomian-jiangjun-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private renderShareImage(r: GameResult) {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d")!;
    const url = shareUrl();
    const lines = shareLines(r);
    const cnFont = `"STKaiti", "Kaiti SC", "KaiTi", "Songti SC", serif`;
    const pixelFont = `"Press Start 2P", monospace`;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#071126";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.16)";
      ctx.fillRect(0, y, canvas.width, 3);
    }

    drawPixelPanel(ctx, 42, 42, 816, 1196);
    drawCenteredText(ctx, "《泡面将军》", 450, 130, `54px ${cnFont}`, "#ffd03d", 5, "#8e1515");

    const faceX = 320;
    const faceY = 178;
    const faceSize = 260;
    ctx.fillStyle = "#05080f";
    ctx.fillRect(faceX - 12, faceY - 12, faceSize + 24, faceSize + 24);
    ctx.strokeStyle = "#6e9ad7";
    ctx.lineWidth = 8;
    ctx.strokeRect(faceX - 12, faceY - 12, faceSize + 24, faceSize + 24);
    if (this.hasResultSnap) {
      ctx.save();
      ctx.translate(faceX + faceSize, faceY);
      ctx.scale(-1, 1);
      ctx.drawImage(this.resultSnap, 0, 0, faceSize, faceSize);
      ctx.restore();
    } else {
      drawCenteredText(ctx, "定 格 表 情", 450, faceY + 138, `28px ${cnFont}`, "#f3ddb0");
    }

    let y = 508;
    for (const line of lines) {
      drawCenteredText(ctx, line.label, 255, y, `31px ${cnFont}`, "#f3ddb0");
      drawCenteredText(ctx, line.value, 610, y, `34px ${cnFont}`, line.hot ? "#ffcf34" : "#f4e4ba");
      y += 72;
    }

    drawCenteredText(ctx, "你 敢 挑 战 吗 ？", 450, y + 28, `34px ${cnFont}`, "#ff4436", 3, "#090909");

    const qrCanvas = document.createElement("canvas");
    qrCanvas.width = 196;
    qrCanvas.height = 196;
    renderQrToCanvas(url, qrCanvas);
    ctx.fillStyle = "#f7edd0";
    ctx.fillRect(352, 836, 196, 196);
    ctx.drawImage(qrCanvas, 352, 836);
    drawCenteredText(ctx, "扫码出征", 450, 1070, `27px ${cnFont}`, "#f4e4ba");
    drawCenteredText(ctx, url, 450, 1126, `18px ${pixelFont}`, "#82e5ff");
    drawCenteredText(ctx, "ZAI · 2046", 450, 1190, `18px ${pixelFont}`, "#bba46d");
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

function shareLines(r: GameResult) {
  if (r.mode === "minute") {
    return [
      { label: "挑战时长", value: "60 秒" },
      { label: "吃完碗数", value: `${r.bowls} 碗`, hot: true },
      { label: "击败玩家", value: `${r.beatPct}%` },
      { label: "获得称号", value: r.grade, hot: true },
      { label: "最高连击", value: `x${r.maxCombo}` },
    ];
  }
  if (r.mode === "campaign") {
    return [
      { label: "总用时", value: `${r.time.toFixed(2)} 秒` },
      { label: "通关进度", value: `${r.stagesCleared}/${r.totalStages} 关`, hot: true },
      { label: "击败玩家", value: `${r.beatPct}%` },
      { label: "获得称号", value: r.grade, hot: true },
      { label: "最高连击", value: `x${r.maxCombo}` },
    ];
  }
  return [
    { label: "完成时间", value: `${r.time.toFixed(2)} 秒` },
    { label: "世界排名", value: `#${r.rank.toLocaleString()}`, hot: true },
    { label: "击败玩家", value: `${r.beatPct}%` },
    { label: "获得称号", value: r.grade, hot: true },
    { label: "最高连击", value: `x${r.maxCombo}` },
  ];
}

function drawPixelPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#0d2142";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffd03d";
  ctx.lineWidth = 10;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = "#6e9ad7";
  ctx.lineWidth = 5;
  ctx.strokeRect(x + 18, y + 18, w - 36, h - 36);
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

function copyCanvas(from: HTMLCanvasElement, to: HTMLCanvasElement) {
  const ctx = to.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, to.width, to.height);
  ctx.drawImage(from, 0, 0, to.width, to.height);
}
