import "./style.css";
import { Engine } from "./game/engine";
import { CAMPAIGN_STAGES, makeCampaignBoss } from "./game/campaign";
import { Scene } from "./render/scene";
import { FaceTracker } from "./face/tracker";
import { submitCampaignScore, submitMinuteScore, submitScore } from "./game/leaderboard";
import { DEFAULT_NOODLE_BOSS, findNoodleBoss } from "./game/noodles";
import { UI, show, hide } from "./ui";
import { SoundBoard } from "./audio";
import type { GameMode, GameResult, MetricsSource, NoodleBoss } from "./game/types";

const ui = new UI();
const sceneCanvas = document.getElementById("scene") as HTMLCanvasElement;
const bossCanvas = document.getElementById("boss-mini") as HTMLCanvasElement;
const camVideo = document.getElementById("cam") as HTMLVideoElement;
const bootStatus = document.getElementById("boot-status")!;

const scene = new Scene(sceneCanvas, bossCanvas);
const sounds = new SoundBoard();
const PLAYER_NAME_KEY = "paomian-jiangjun-player-name";
const DEFAULT_PLAYER_NAME = "Beta";
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
let sessionId = 0;

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
  if (selectedMode === "campaign") {
    startCampaign();
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

function startCampaign() {
  sessionId++;
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
  engine.update(dt, m);
  scene.update(dt, engine.state);
  scene.render(engine.state);
  ui.sync(engine.state);
  ui.setMeters(m.blow, m.suck, engine.state.phase);
  sounds.setSlurping(engine.state.phase === "suck" && engine.state.acting);

  ui.setSignal(m.hasFace, m.hasFace ? "已锁定面部" : "未检测到面部");
}
requestAnimationFrame(frame);

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
