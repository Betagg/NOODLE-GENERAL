import "./style.css";
import { Engine } from "./game/engine";
import { CAMPAIGN_STAGES, makeCampaignBoss } from "./game/campaign";
import { Scene } from "./render/scene";
import { FaceTracker } from "./face/tracker";
import { submitCampaignScore, submitMinuteScore, submitScore } from "./game/leaderboard";
import { DEFAULT_NOODLE_BOSS, findNoodleBoss } from "./game/noodles";
import { UI, show, hide } from "./ui";
import { SoundBoard } from "./audio";
import type { DuelViewPlayer } from "./ui";
import type { FaceMetrics, GameMode, GameResult, GameState, MetricsSource, NoodleBoss, PlayerFaceMetrics } from "./game/types";

const ui = new UI();
const sceneCanvas = document.getElementById("scene") as HTMLCanvasElement;
const bossCanvas = document.getElementById("boss-mini") as HTMLCanvasElement;
const camVideo = document.getElementById("cam") as HTMLVideoElement;
const bootStatus = document.getElementById("boot-status")!;

const scene = new Scene(sceneCanvas, bossCanvas);
const sounds = new SoundBoard();
const PLAYER_NAME_KEY = "paomian-jiangjun-player-name";
const DEFAULT_PLAYER_NAME = "Beta";
const DUEL_TARGET_TEMP = 35;
const DUEL_BLOW_TRIGGER = 0.34;
const DUEL_BLOW_RELEASE = 0.16;
const DUEL_BLOW_PUFF_SECONDS = 0.42;
const DUEL_BLOW_CHAIN_GRACE = 1.1;
const DUEL_SUCK_THRESHOLD = 0.3;
const DUEL_SUCK_ARM_MS = 260;
const DUEL_COOL_RATE = 26;
const DUEL_SUCK_RATE = 30;
const DUEL_COMBO_TICK = 0.32;
const DUEL_BLOW_LINES = [
  "双人开吹，汤面开始摇摆。",
  "有人降温，有人还在摆造型。",
  "热浪撤退，面子不保。",
  "敌将同时遭遇两张嘴。",
];
const DUEL_SUCK_LINES = [
  "有人开吸，碗里局势紧张。",
  "面条减少，友情也减少。",
  "吸力上线，桌面进入战争状态。",
  "对手还在努力，泡面已经报警。",
];
const playerNameEl = document.getElementById("player-name")!;
const nameGate = document.getElementById("name-gate")!;
const firstNameInput = document.getElementById("first-name-input") as HTMLInputElement;
const nameConfirmBtn = document.getElementById("name-confirm-btn")!;

let source: MetricsSource | null = null;
let tracker: FaceTracker | null = null;
let lastResult: GameResult | null = null;
let running = false;
let selectedBoss: NoodleBoss = DEFAULT_NOODLE_BOSS;
let selectedMode: GameMode = "classic";
let playerName = loadPlayerName();
let hasConfirmedPlayerName = hasStoredPlayerName();
let campaignStageIndex = 0;
let campaignElapsed = 0;
let campaignMaxCombo = 0;
let duelPlayers: [DuelPlayerState, DuelPlayerState] = makeDuelPlayers();
let duelWinnerIndex: number | null = null;
let duelElapsed = 0;
let sessionId = 0;

interface DuelPlayerState extends DuelViewPlayer {
  blow: number;
  suck: number;
  acting: boolean;
  combo: number;
  maxCombo: number;
  blowReady: boolean;
  blowPuffTimer: number;
  blowPuffStrength: number;
  armMs: number;
  idleTimer: number;
  comboTimer: number;
  reportTimer: number;
  finishTime: number | null;
}

const engine = new Engine({
  onReport: (text, kind) => {
    ui.pushReport(text, kind);
    if (kind === "crit" || kind === "suck") scene.hit();
  },
  onPhase: (phase) => ui.setPhase(phase),
  onWin: () => {
    if (engine.state.mode !== "campaign" || campaignStageIndex >= CAMPAIGN_STAGES.length - 1) {
      sounds.victory();
    }
    endGame();
  },
});

// ---------------- boot ----------------
const startBtn = document.getElementById("start-btn")!;
const homeBtn = document.getElementById("home-btn")!;
const noodleOptions = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-noodle]"),
);
const modeOptions = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-mode]"),
);
let homeScreenActive = true;

sounds.preloadHomeAmbience();
void sounds.startHomeAmbience();
document.addEventListener("pointerdown", () => {
  if (homeScreenActive) sounds.startHomeAmbience();
}, { once: true });
document.addEventListener("keydown", () => {
  if (homeScreenActive) sounds.startHomeAmbience();
}, { once: true });

for (const option of noodleOptions) {
  option.addEventListener("click", () => {
    selectBoss(option.dataset.noodle ?? DEFAULT_NOODLE_BOSS.id, true);
  });
}
for (const option of modeOptions) {
  option.addEventListener("click", () => {
    selectMode((option.dataset.mode as GameMode | undefined) ?? "classic");
  });
}
selectBoss(DEFAULT_NOODLE_BOSS.id);
selectMode(selectedMode);
ui.setPlayerName(playerName);
bindPlayerNameEditor();

startBtn.addEventListener("click", () => {
  if (!hasConfirmedPlayerName) {
    showNameGate();
    return;
  }
  void launchGame();
});
nameConfirmBtn.addEventListener("click", () => {
  confirmFirstName();
});
firstNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmFirstName();
  }
});

async function launchGame() {
  homeScreenActive = false;
  sounds.stopHomeAmbience();
  startBtn.setAttribute("disabled", "true");
  await sounds.unlock();
  tracker = new FaceTracker(camVideo);
  try {
    await tracker.start((m) => (bootStatus.textContent = m));
    source = tracker;
    beginGame();
  } catch (err) {
    console.error(err);
    bootStatus.textContent = "摄像头不可用，请允许摄像头权限后重试";
    startBtn.removeAttribute("disabled");
  }
}
homeBtn.addEventListener("click", returnHome);

function showNameGate() {
  firstNameInput.value = playerName;
  nameGate.classList.remove("hidden");
  window.setTimeout(() => {
    firstNameInput.focus();
    firstNameInput.select();
  }, 0);
}

function confirmFirstName() {
  if (nameGate.classList.contains("hidden")) return;
  setPlayerName(firstNameInput.value);
  hasConfirmedPlayerName = true;
  nameGate.classList.add("hidden");
  void launchGame();
}

function beginGame() {
  sessionId++;
  hide("boot");
  show("app");
  ui.setDuelVisible(false);
  if (selectedMode === "campaign") {
    startCampaign();
    return;
  }
  if (selectedMode === "duel") {
    startDuel();
    return;
  }

  engine.setMode(selectedMode);
  engine.setBoss(selectedBoss);
  ui.setBoss(selectedBoss);
  engine.reset();
  engine.state.campaignStage = 0;
  engine.state.totalStages = 0;
  ui.setCampaignRankText(0, 0);
  ui.clearReport();
  ui.pushReport(
    selectedMode === "minute"
      ? `一分钟挑战！尽量多吃${selectedBoss.name}！`
      : `战斗开始！吹凉这碗${selectedBoss.name}！`,
    "normal",
  );
  ui.setSignal(true, "识别中…");
  running = true;
}

function selectBoss(id: string, resetRound = false) {
  if (resetRound && running && selectedMode === "campaign") {
    ui.pushReport("征战中不可临阵换敌将，敌将会自己排队送来。", "normal");
    return;
  }

  const nextBoss = findNoodleBoss(id);
  const changed = nextBoss.id !== selectedBoss.id;
  selectedBoss = nextBoss;
  ui.setBoss(selectedBoss);
  syncBossOptions();
  engine.setBoss(selectedBoss);

  if (resetRound && running && changed) {
    sounds.setSlurping(false);
    if (selectedMode === "duel") {
      startDuel();
      return;
    }
    engine.reset();
    ui.clearReport();
    ui.pushReport(`敌将切换！现在挑战${selectedBoss.name}！`, "crit");
  }
}

function selectMode(mode: GameMode) {
  selectedMode = mode;
  for (const option of modeOptions) {
    option.classList.toggle("selected", option.dataset.mode === selectedMode);
  }
  engine.setMode(selectedMode);
}

function startDuel() {
  sessionId++;
  duelPlayers = makeDuelPlayers();
  duelWinnerIndex = null;
  duelElapsed = 0;

  engine.setMode("duel");
  engine.setBoss(selectedBoss);
  ui.setBoss(selectedBoss);
  ui.setCampaignRankText(0, 0);
  ui.setDuelVisible(true);
  ui.clearReport();
  ui.pushReport("双人PK！两位将军同时入镜，谁先吸完谁胜。", "crit");
  ui.pushReport("左边归左将，右边归右将；请保持同屏。", "normal");
  ui.setSignal(false, "等待双人入镜 0/2");
  ui.syncDuel(duelPlayers, duelElapsed, duelWinnerIndex);
  running = true;
}

function startCampaign() {
  sessionId++;
  ui.setDuelVisible(false);
  campaignStageIndex = 0;
  campaignElapsed = 0;
  campaignMaxCombo = 0;
  startCampaignStage(0, true);
}

function startCampaignStage(stageIndex: number, clearReport: boolean) {
  const stage = CAMPAIGN_STAGES[stageIndex];
  const boss = makeCampaignBoss(stageIndex);

  selectedBoss = boss;
  engine.setMode("campaign");
  engine.setBoss(boss);
  ui.setBoss(boss);
  syncBossOptions();
  engine.reset();
  engine.state.campaignStage = stageIndex + 1;
  engine.state.totalStages = CAMPAIGN_STAGES.length;
  ui.setCampaignRankText(stageIndex, CAMPAIGN_STAGES.length);
  if (clearReport) ui.clearReport();
  ui.pushReport(`第 ${stageIndex + 1}/${CAMPAIGN_STAGES.length} 关：${stage.title}`, "crit");
  ui.pushReport(stage.briefing, "normal");
  ui.setSignal(true, "识别中…");
  running = true;
}

function syncBossOptions() {
  for (const option of noodleOptions) {
    option.classList.toggle("selected", option.dataset.noodle === selectedBoss.id);
  }
}

// ---------------- main loop ----------------
let prev = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  if (!running || !source) return;

  const m = source.get();
  if (selectedMode === "duel") {
    updateDuel(dt, m);
    return;
  }

  engine.update(dt, m);
  scene.update(dt, engine.state);
  scene.render(engine.state);
  ui.sync(engine.state);
  ui.setMeters(m.blow, m.suck, engine.state.phase);
  sounds.setSlurping(engine.state.phase === "suck" && engine.state.acting);

  ui.setSignal(m.hasFace, m.hasFace ? "已锁定面部" : "未检测到面部");
}
requestAnimationFrame(frame);

// ---------------- two-player duel ----------------
function updateDuel(dt: number, m: FaceMetrics) {
  const detected = m.players ?? [];
  syncDuelFaces(detected);
  const readyCount = detected.filter((p) => p.hasFace).length;
  const ready = readyCount >= 2;

  if (ready) {
    duelElapsed += dt;
    for (let index = 0; index < duelPlayers.length; index++) {
      updateDuelPlayer(duelPlayers[index], detected[index]!, dt);
    }
  } else {
    for (const player of duelPlayers) player.acting = false;
  }

  const winner = duelPlayers.findIndex((player) => player.finished);
  renderDuel(dt, ready);

  if (winner >= 0 && duelWinnerIndex === null) {
    finishDuel(winner);
    return;
  }

  ui.setSignal(ready, ready ? "双人已锁定，开抢！" : `等待双人入镜 ${readyCount}/2`);
  sounds.setSlurping(ready && duelPlayers.some((player) => player.phase === "suck" && player.acting));
}

function syncDuelFaces(faces: PlayerFaceMetrics[]) {
  for (let index = 0; index < duelPlayers.length; index++) {
    const face = faces[index];
    const player = duelPlayers[index];
    player.hasFace = !!face?.hasFace;
    player.blow = face?.blow ?? 0;
    player.suck = face?.suck ?? 0;
  }
}

function updateDuelPlayer(player: DuelPlayerState, face: PlayerFaceMetrics, dt: number) {
  if (player.phase === "win") return;
  player.reportTimer -= dt;

  if (player.phase === "blow") {
    updateDuelBlow(player, face, dt);
  } else if (player.phase === "suck") {
    updateDuelSuck(player, face, dt);
  }
}

function updateDuelBlow(player: DuelPlayerState, face: PlayerFaceMetrics, dt: number) {
  if (face.blow < DUEL_BLOW_RELEASE) player.blowReady = true;

  const newPuff = player.blowReady && face.blow >= DUEL_BLOW_TRIGGER;
  if (newPuff) {
    player.blowReady = false;
    player.idleTimer = 0;
    player.blowPuffTimer = DUEL_BLOW_PUFF_SECONDS;
    player.blowPuffStrength = Math.max(0.24, duelBlowStrength(face.blow));
    player.combo++;
    player.maxCombo = Math.max(player.maxCombo, player.combo);

    if (player.combo > 0 && player.combo % 10 === 0) {
      ui.pushReport(`${player.name} 连击 x${player.combo}`, "combo");
    } else if (player.reportTimer <= 0) {
      player.reportTimer = 0.55;
      ui.pushReport(`${player.name}：${pickDuel(DUEL_BLOW_LINES)}`, "normal");
    }
  } else {
    player.idleTimer += dt;
  }

  if (player.blowPuffTimer > 0) {
    player.blowPuffTimer = Math.max(0, player.blowPuffTimer - dt);
    player.blowPuffStrength = Math.max(player.blowPuffStrength, duelBlowStrength(face.blow));
    const comboMult = 1 + player.combo * 0.04;
    const drop =
      DUEL_COOL_RATE * selectedBoss.coolingFactor * player.blowPuffStrength * comboMult * dt;
    player.temperature = Math.max(DUEL_TARGET_TEMP, player.temperature - drop);
  }
  player.acting = player.blowPuffTimer > 0;

  if (player.idleTimer > DUEL_BLOW_CHAIN_GRACE && player.combo > 0) {
    player.combo = 0;
    player.comboTimer = 0;
  }

  if (player.temperature <= DUEL_TARGET_TEMP + 0.01) {
    player.phase = "suck";
    player.temperature = DUEL_TARGET_TEMP;
    player.armMs = 0;
    player.blowPuffTimer = 0;
    player.acting = false;
    ui.pushReport(`${player.name} 进入吸面时间。`, "suck");
  }
}

function updateDuelSuck(player: DuelPlayerState, face: PlayerFaceMetrics, dt: number) {
  const active = face.suck > DUEL_SUCK_THRESHOLD;
  if (active) {
    player.armMs += dt * 1000;
  } else {
    player.armMs = Math.max(0, player.armMs - dt * 2000);
  }

  const sucking = active && player.armMs >= DUEL_SUCK_ARM_MS;
  player.acting = sucking;

  if (sucking) {
    player.idleTimer = 0;
    player.comboTimer += dt;
    while (player.comboTimer >= DUEL_COMBO_TICK) {
      player.comboTimer -= DUEL_COMBO_TICK;
      player.combo++;
      player.maxCombo = Math.max(player.maxCombo, player.combo);
      if (player.combo > 0 && player.combo % 10 === 0) {
        ui.pushReport(`${player.name} 连击 x${player.combo}`, "combo");
      }
    }

    const comboMult = 1 + player.combo * 0.045;
    const strength = (face.suck - DUEL_SUCK_THRESHOLD) / (1 - DUEL_SUCK_THRESHOLD);
    const eaten = DUEL_SUCK_RATE * selectedBoss.slurpFactor * strength * comboMult * dt;
    player.noodle = Math.max(0, player.noodle - eaten);

    if (player.reportTimer <= 0) {
      player.reportTimer = 0.58;
      ui.pushReport(`${player.name}：${pickDuel(DUEL_SUCK_LINES)}`, "suck");
    }
  } else {
    player.idleTimer += dt;
    if (player.idleTimer > 0.6 && player.combo > 0) {
      player.combo = 0;
      player.comboTimer = 0;
    }
  }

  if (player.noodle <= 0.01) {
    player.noodle = 0;
    player.phase = "win";
    player.finished = true;
    player.finishTime = duelElapsed;
    player.acting = false;
  }
}

function renderDuel(dt: number, ready: boolean) {
  const leader = duelWinnerIndex === null ? duelLeader() : duelPlayers[duelWinnerIndex];
  const duelState = makeDuelSceneState(leader);
  ui.sync(duelState);
  ui.syncDuel(duelPlayers, duelElapsed, duelWinnerIndex);
  ui.setDuelMeters(
    ready ? Math.max(duelPlayers[0].phase === "blow" ? duelPlayers[0].blow : 0, duelPlayers[1].phase === "blow" ? duelPlayers[1].blow : 0) : 0,
    ready ? Math.max(duelPlayers[0].phase === "suck" ? duelPlayers[0].suck : 0, duelPlayers[1].phase === "suck" ? duelPlayers[1].suck : 0) : 0,
  );
  scene.update(dt, duelState);
  scene.render(duelState);
}

function duelLeader() {
  return duelScore(duelPlayers[1]) > duelScore(duelPlayers[0]) ? duelPlayers[1] : duelPlayers[0];
}

function duelScore(player: DuelPlayerState) {
  return (100 - player.noodle) * 1.4 + (100 - player.temperature) * 0.8 + (player.phase === "suck" ? 35 : 0);
}

function makeDuelSceneState(player: DuelPlayerState): GameState {
  return {
    mode: "duel",
    phase: player.phase,
    temperature: player.temperature,
    targetTemp: DUEL_TARGET_TEMP,
    noodle: player.noodle,
    bowls: 0,
    campaignStage: 0,
    totalStages: 0,
    timeLimit: null,
    boss: selectedBoss,
    combo: player.combo,
    maxCombo: Math.max(duelPlayers[0].maxCombo, duelPlayers[1].maxCombo),
    elapsed: duelElapsed,
    blow: Math.max(duelPlayers[0].blow, duelPlayers[1].blow),
    suck: Math.max(duelPlayers[0].suck, duelPlayers[1].suck),
    acting: player.acting,
    exp: 24 + (200 - duelPlayers[0].noodle - duelPlayers[1].noodle) * 0.18,
  };
}

function finishDuel(winnerIndex: number) {
  duelWinnerIndex = winnerIndex;
  running = false;
  sounds.setSlurping(false);
  sounds.victory();

  const winner = duelPlayers[winnerIndex];
  const loser = duelPlayers[winnerIndex === 0 ? 1 : 0];
  lastResult = makeDuelResult(winner, loser);
  ui.syncDuel(duelPlayers, duelElapsed, duelWinnerIndex);
  ui.pushReport(`${winner.name} 抢先吃完，${loser.name} 已吃 ${Math.round(100 - loser.noodle)}%。`, "crit");

  const token = sessionId;
  window.setTimeout(() => {
    if (token !== sessionId) return;
    ui.captureResultFace(camVideo);
    ui.showResult(lastResult!);
  }, 1000);
}

function makeDuelPlayers(): [DuelPlayerState, DuelPlayerState] {
  return [makeDuelPlayer(playerName || DEFAULT_PLAYER_NAME), makeDuelPlayer("二号将军")];
}

function makeDuelPlayer(name: string): DuelPlayerState {
  return {
    name,
    phase: "blow",
    temperature: 100,
    noodle: 100,
    hasFace: false,
    finished: false,
    blow: 0,
    suck: 0,
    acting: false,
    combo: 0,
    maxCombo: 0,
    blowReady: true,
    blowPuffTimer: 0,
    blowPuffStrength: 0,
    armMs: 0,
    idleTimer: 0,
    comboTimer: 0,
    reportTimer: 0,
    finishTime: null,
  };
}

function makeDuelResult(winner: DuelPlayerState, loser: DuelPlayerState): GameResult {
  const time = winner.finishTime ?? duelElapsed;
  const beatPct = duelBeatPercent(time, winner.maxCombo);
  return {
    name: winner.name,
    mode: "duel",
    time,
    maxCombo: Math.max(duelPlayers[0].maxCombo, duelPlayers[1].maxCombo),
    bowls: 1,
    stagesCleared: 1,
    totalStages: 1,
    rank: 1,
    worldSize: 2,
    beatPct,
    grade: duelGrade(time, winner.maxCombo),
    duelWinner: winner.name,
    duelLoser: loser.name,
    duelLoserProgress: Math.round(100 - loser.noodle),
  };
}

function duelBeatPercent(time: number, maxCombo: number) {
  const speed = time <= 10 ? 25 : time <= 16 ? 16 : time <= 24 ? 8 : 2;
  return Math.max(51, Math.min(99, 58 + speed + Math.min(16, Math.floor(maxCombo / 4))));
}

function duelGrade(time: number, maxCombo: number) {
  if (time <= 10 && maxCombo >= 18) return "同桌灭面王";
  if (time <= 14) return "抢面大将军";
  if (time <= 22) return "双人面王";
  return "同桌校尉";
}

function duelBlowStrength(signal: number) {
  return clamp01((signal - DUEL_BLOW_RELEASE) / (1 - DUEL_BLOW_RELEASE));
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pickDuel(lines: string[]) {
  return lines[Math.floor(Math.random() * lines.length)];
}

// ---------------- win / result ----------------
function endGame() {
  const s = engine.state;
  sounds.setSlurping(false);

  if (s.mode === "campaign") {
    running = false;
    campaignElapsed += s.elapsed;
    campaignMaxCombo = Math.max(campaignMaxCombo, s.maxCombo);

    const cleared = campaignStageIndex + 1;
    if (cleared < CAMPAIGN_STAGES.length) {
      ui.setCampaignRankText(cleared, CAMPAIGN_STAGES.length);
      ui.pushReport(`第 ${cleared} 关肃清，用时 ${s.elapsed.toFixed(2)} 秒。`, "crit");
      campaignStageIndex = cleared;
      const token = sessionId;
      window.setTimeout(() => {
        if (token !== sessionId) return;
        startCampaignStage(campaignStageIndex, false);
      }, 700);
      return;
    }

    lastResult = submitCampaignScore(
      campaignElapsed,
      campaignMaxCombo,
      cleared,
      CAMPAIGN_STAGES.length,
      playerName,
    );
    ui.setCampaignRankText(cleared, CAMPAIGN_STAGES.length);
    ui.pushReport(`五关平定，总用时 ${campaignElapsed.toFixed(2)} 秒。`, "crit");
    const token = sessionId;
    window.setTimeout(() => {
      if (token !== sessionId) return;
      ui.captureResultFace(camVideo);
      ui.showResult(lastResult!);
    }, 1000);
    return;
  }

  running = false;
  lastResult =
    s.mode === "minute"
      ? submitMinuteScore(s.elapsed, s.maxCombo, s.bowls, playerName)
      : submitScore(s.elapsed, s.maxCombo, playerName);
  ui.pushReport(
    s.mode === "minute" ? `时间到！共吃 ${s.bowls} 碗` : `胜利！用时 ${s.elapsed.toFixed(2)} 秒`,
    "crit",
  );
  const token = sessionId;
  window.setTimeout(() => {
    if (token !== sessionId) return;
    ui.captureResultFace(camVideo);
    ui.showResult(lastResult!);
  }, 1000);
}

// ---------------- result buttons ----------------
document.getElementById("again-btn")!.addEventListener("click", () => {
  sessionId++;
  hide("result");
  sounds.setSlurping(false);
  if (selectedMode === "campaign") {
    startCampaign();
    return;
  }
  if (selectedMode === "duel") {
    startDuel();
    return;
  }

  ui.setDuelVisible(false);
  engine.setMode(selectedMode);
  engine.setBoss(selectedBoss);
  ui.setBoss(selectedBoss);
  engine.reset();
  ui.clearReport();
  ui.pushReport(
    selectedMode === "minute"
      ? `再来一分钟，继续吞并${selectedBoss.name}！`
      : `再来一碗${selectedBoss.name}！这次更快！`,
    "normal",
  );
  running = true;
});

function returnHome() {
  sessionId++;
  running = false;
  source = null;
  sounds.setSlurping(false);
  tracker?.stop();
  tracker = null;
  startBtn.removeAttribute("disabled");
  bootStatus.textContent = "";
  ui.clearReport();
  ui.setCampaignRankText(0, 0);
  ui.setDuelVisible(false);
  hide("app");
  hide("result");
  hide("share");
  show("boot");
  homeScreenActive = true;
  void sounds.startHomeAmbience();
}

document.getElementById("share-btn")!.addEventListener("click", () => {
  if (lastResult) ui.showShare(lastResult, camVideo);
});

document.getElementById("back-btn")!.addEventListener("click", () => {
  hide("share");
  show("result");
});

document.getElementById("copy-btn")!.addEventListener("click", async () => {
  if (!lastResult) return;
  try {
    await ui.downloadShareImage(lastResult);
    showToast("战绩图片已生成！");
  } catch (err) {
    console.error(err);
    showToast("图片生成失败，请再试一次");
  }
});

function showToast(text: string) {
  const toast = document.getElementById("copy-toast")!;
  toast.textContent = text;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), 1600);
}

function bindPlayerNameEditor() {
  let editingSnapshot = playerName;

  playerNameEl.addEventListener("focus", () => {
    editingSnapshot = playerName;
    playerNameEl.classList.add("editing");
    selectElementText(playerNameEl);
  });

  playerNameEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      playerNameEl.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      playerNameEl.textContent = editingSnapshot;
      playerNameEl.blur();
    }
  });

  playerNameEl.addEventListener("blur", () => {
    playerNameEl.classList.remove("editing");
    setPlayerName(playerNameEl.textContent ?? "");
  });
}

function loadPlayerName() {
  try {
    return normalizePlayerName(localStorage.getItem(PLAYER_NAME_KEY) ?? DEFAULT_PLAYER_NAME);
  } catch {
    return DEFAULT_PLAYER_NAME;
  }
}

function setPlayerName(name: string) {
  playerName = normalizePlayerName(name);
  localStorage.setItem(PLAYER_NAME_KEY, playerName);
  hasConfirmedPlayerName = true;
  ui.setPlayerName(playerName);
}

function hasStoredPlayerName() {
  try {
    const value = localStorage.getItem(PLAYER_NAME_KEY);
    return !!value && normalizePlayerName(value).length > 0;
  } catch {
    return false;
  }
}

function normalizePlayerName(name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  return Array.from(clean || DEFAULT_PLAYER_NAME).slice(0, 12).join("");
}

function selectElementText(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
}
