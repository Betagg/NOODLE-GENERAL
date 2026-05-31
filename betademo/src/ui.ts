import type { GameState, GameResult, NoodleBoss, ReportKind } from "./game/types";
import { getCampaignTop, getMinuteTop, getTop } from "./game/leaderboard";

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
    // Reuse the victory freeze-frame so the share card matches the result screen.
    if (this.hasResultSnap) {
      copyCanvas(this.resultSnap, this.shareSnap);
    } else if (snapFrom) {
      this.hasResultSnap = drawVideoToCanvas(snapFrom, this.shareSnap);
    }
    hide("result");
    show("share");
  }

  shareText(r: GameResult): string {
    if (r.mode === "minute") {
      return [
        "《泡面将军》一分钟挑战",
        `${r.name} 60 秒吃完 ${r.bowls} 碗，击败了 ${r.beatPct}% 的玩家`,
        `获得称号：${r.grade}`,
        "你敢挑战吗？",
      ].join("\n");
    }
    if (r.mode === "campaign") {
      return [
        "《泡面将军》征战模式",
        `${r.name} 通关 ${r.stagesCleared}/${r.totalStages} 关，总用时 ${r.time.toFixed(2)} 秒`,
        `获得称号：${r.grade}`,
        "你敢挑战吗？",
      ].join("\n");
    }
    return [
      "《泡面将军》",
      `${r.name} 用了 ${r.time.toFixed(2)} 秒，击败了 ${r.beatPct}% 的玩家`,
      `获得称号：${r.grade}`,
      "你敢挑战吗？",
    ].join("\n");
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
