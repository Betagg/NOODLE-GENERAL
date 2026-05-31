import { DEFAULT_NOODLE_BOSS } from "./noodles";
import type { FaceMetrics, GameMode, GameState, NoodleBoss, Phase, ReportKind } from "./types";

const START_TEMP = 100;
const TARGET_TEMP = 35;
const MINUTE_LIMIT = 60;
const BLOW_TRIGGER_THRESHOLD = 0.34; // O-mouth signal needed to trigger a new puff
const BLOW_RELEASE_THRESHOLD = 0.16; // mouth must relax below this before next puff
const BLOW_PUFF_SECONDS = 0.42; // one O-mouth change creates a short cooling gust
const BLOW_CHAIN_GRACE = 1.1; // seconds allowed between puffs before combo resets
const SUCK_THRESHOLD = 0.3; // rounded-lips signal needed to count as sucking
const SUCK_ARM_MS = 260; // lips must stay rounded this long before sucking counts
const COOL_RATE = 26; // ℃ per second at full blow, combo 1
const SUCK_RATE = 30; // %/s at full sucking signal, combo 1
const COMBO_TICK = 0.32; // seconds of sustained action per +1 combo
const BLOW_LINES = [
  "又一口风，敌将稍凉。",
  "热浪后退，尊严保留。",
  "这口气，够它反省。",
  "汤面沉默，温度下跪。",
  "别停，面还想烫你。",
  "敌军掉温，碗里失守。",
];
const CRIT_LINES = [
  "暴击！热浪当场辞职。",
  "暴击！泡面开始怀疑人生。",
  "暴击！汤底短暂服软。",
  "暴击！敌将体温失守。",
];
const READY_LINES = [
  "35℃达标，命运开饭。",
  "温度合规，可以下嘴。",
  "敌将凉了，轮到你狠了。",
];
const SUCK_LINES = [
  "吸住了，命运少一截。",
  "面条退场，汤底沉默。",
  "这一吸，敌军少编制。",
  "别松嘴，泡面会反扑。",
  "敌将缩水，战局可食。",
  "吸力在线，碗里告急。",
];
const NEXT_BOWL_LINES = [
  "下一碗上桌，命运加餐。",
  "空碗退场，新敌将抵达。",
  "军粮续上，良心下线。",
  "又来一碗，胃部请命。",
];

export interface EngineCallbacks {
  onReport(text: string, kind: ReportKind): void;
  onPhase(phase: Phase): void;
  onBlowPuff?(crit: boolean): void;
  onBowlComplete?(bowls: number): void;
  onWin(): void;
}

export class Engine {
  state: GameState;
  private cb: EngineCallbacks;
  private boss: NoodleBoss = DEFAULT_NOODLE_BOSS;
  private mode: GameMode = "classic";
  private comboTimer = 0;
  private idleTimer = 0;
  private armTimer = 0;
  private reportTimer = 0;
  private started = false;
  private blowReady = true;
  private blowPuffTimer = 0;
  private blowPuffStrength = 0;
  private blowPuffCrit = false;

  constructor(cb: EngineCallbacks) {
    this.cb = cb;
    this.state = this.fresh();
  }

  private fresh(): GameState {
    return {
      mode: this.mode,
      phase: "blow",
      temperature: START_TEMP,
      targetTemp: TARGET_TEMP,
      noodle: 100,
      bowls: 0,
      campaignStage: 0,
      totalStages: 0,
      timeLimit: this.mode === "minute" ? MINUTE_LIMIT : null,
      boss: this.boss,
      combo: 0,
      maxCombo: 0,
      elapsed: 0,
      blow: 0,
      suck: 0,
      acting: false,
      exp: 24,
    };
  }

  reset() {
    this.state = this.fresh();
    this.comboTimer = 0;
    this.idleTimer = 0;
    this.armTimer = 0;
    this.reportTimer = 0;
    this.started = this.mode === "minute";
    this.blowReady = true;
    this.blowPuffTimer = 0;
    this.blowPuffStrength = 0;
    this.blowPuffCrit = false;
    this.cb.onPhase("blow");
  }

  setBoss(boss: NoodleBoss) {
    this.boss = boss;
    if (this.state.phase !== "win") this.state.boss = boss;
  }

  setMode(mode: GameMode) {
    this.mode = mode;
    if (this.state.phase !== "win") {
      this.state.mode = mode;
      this.state.timeLimit = mode === "minute" ? MINUTE_LIMIT : null;
    }
  }

  update(dt: number, m: FaceMetrics) {
    const s = this.state;
    if (s.phase === "win") return;

    s.blow = m.blow;
    s.suck = m.suck;

    if (s.phase === "blow") this.updateBlow(dt, m);
    else if (s.phase === "suck") this.updateSuck(dt, m);

    if (this.started) {
      const limit = s.timeLimit ?? Number.POSITIVE_INFINITY;
      s.elapsed = Math.min(limit, s.elapsed + dt);
    }
    this.reportTimer -= dt;

    if (s.mode === "minute" && this.started && s.elapsed >= MINUTE_LIMIT) {
      this.finishWin();
    }
  }

  // ---- Phase 1: 吹凉泡面 ----
  private updateBlow(dt: number, m: FaceMetrics) {
    const s = this.state;
    const released = m.blow < BLOW_RELEASE_THRESHOLD;
    if (released) this.blowReady = true;

    const newPuff = this.blowReady && m.blow >= BLOW_TRIGGER_THRESHOLD;
    if (newPuff) {
      if (!this.started) this.started = true;
      this.blowReady = false;
      this.idleTimer = 0;
      this.blowPuffTimer = BLOW_PUFF_SECONDS;
      this.blowPuffStrength = Math.max(0.24, blowStrength(m.blow));
      this.blowPuffCrit = Math.random() < 0.06 + s.combo * 0.004;
      this.cb.onBlowPuff?.(this.blowPuffCrit);
      s.combo++;
      s.maxCombo = Math.max(s.maxCombo, s.combo);

      if (s.combo > 0 && s.combo % 10 === 0) {
        this.cb.onReport(`连击 x${s.combo}`, "combo");
      } else if (this.reportTimer <= 0) {
        this.reportTimer = 0.45;
        this.cb.onReport(
          pick(this.blowPuffCrit ? CRIT_LINES : BLOW_LINES),
          this.blowPuffCrit ? "crit" : "normal",
        );
      }
    } else {
      this.idleTimer += dt;
    }

    if (this.blowPuffTimer > 0) {
      this.blowPuffTimer = Math.max(0, this.blowPuffTimer - dt);
      this.blowPuffStrength = Math.max(this.blowPuffStrength, blowStrength(m.blow));
      const comboMult = 1 + s.combo * 0.05;
      let drop = COOL_RATE * s.boss.coolingFactor * this.blowPuffStrength * comboMult * dt;
      if (this.blowPuffCrit) drop *= 2.1;

      s.temperature = Math.max(s.targetTemp, s.temperature - drop);
      s.exp += drop * 0.12;
    }
    s.acting = this.blowPuffTimer > 0;

    if (this.idleTimer > BLOW_CHAIN_GRACE && s.combo > 0) {
      s.combo = 0;
      this.comboTimer = 0;
    }

    if (s.temperature <= s.targetTemp + 0.01) {
      s.phase = "suck";
      s.temperature = s.targetTemp;
      this.armTimer = 0;
      this.blowPuffTimer = 0;
      this.cb.onPhase("suck");
      this.cb.onReport(pick(READY_LINES), "suck");
    }
  }

  // ---- Phase 2: 吸面 ----
  private updateSuck(dt: number, m: FaceMetrics) {
    const s = this.state;
    const suck = m.suck > SUCK_THRESHOLD;

    if (suck) {
      this.armTimer += dt * 1000;
    } else {
      this.armTimer = Math.max(0, this.armTimer - dt * 2000);
    }

    const sucking = suck && this.armTimer >= SUCK_ARM_MS;
    s.acting = sucking;

    if (sucking) {
      this.idleTimer = 0;
      this.comboTimer += dt;
      while (this.comboTimer >= COMBO_TICK) {
        this.comboTimer -= COMBO_TICK;
        s.combo++;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        if (s.combo > 0 && s.combo % 10 === 0) {
          this.cb.onReport(`连击 x${s.combo}`, "combo");
        }
      }

      const comboMult = 1 + s.combo * 0.05;
      const strength = (m.suck - SUCK_THRESHOLD) / (1 - SUCK_THRESHOLD);
      const eaten = SUCK_RATE * s.boss.slurpFactor * strength * comboMult * dt;
      s.noodle = Math.max(0, s.noodle - eaten);
      s.exp += eaten * 0.15;

      if (this.reportTimer <= 0) {
        this.reportTimer = 0.5;
        this.cb.onReport(pick(SUCK_LINES), "suck");
      }
    } else {
      this.idleTimer += dt;
      if (this.idleTimer > 0.6 && s.combo > 0) {
        s.combo = 0;
        this.comboTimer = 0;
      }
    }

    if (s.noodle <= 0.01) {
      s.noodle = 0;
      if (s.mode === "minute") {
        s.bowls++;
        this.cb.onBowlComplete?.(s.bowls);
        if (s.elapsed >= MINUTE_LIMIT) {
          this.finishWin();
          return;
        }
        this.nextBowl();
        return;
      }
      s.phase = "win";
      s.acting = false;
      this.cb.onPhase("win");
      this.cb.onWin();
    }
  }

  private nextBowl() {
    const s = this.state;
    s.phase = "blow";
    s.temperature = START_TEMP;
    s.noodle = 100;
    s.blow = 0;
    s.suck = 0;
    s.acting = false;
    s.combo = 0;
    this.comboTimer = 0;
    this.idleTimer = 0;
    this.armTimer = 0;
    this.reportTimer = 0.2;
    this.blowReady = true;
    this.blowPuffTimer = 0;
    this.blowPuffStrength = 0;
    this.blowPuffCrit = false;
    this.cb.onPhase("blow");
    this.cb.onReport(pick(NEXT_BOWL_LINES), "crit");
  }

  private finishWin() {
    if (this.state.phase === "win") return;
    this.state.phase = "win";
    this.state.acting = false;
    this.cb.onPhase("win");
    this.cb.onWin();
  }
}

function blowStrength(signal: number) {
  return clamp01((signal - BLOW_RELEASE_THRESHOLD) / (1 - BLOW_RELEASE_THRESHOLD));
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pick(lines: string[]) {
  return lines[Math.floor(Math.random() * lines.length)];
}
