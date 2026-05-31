export type Phase = "blow" | "suck" | "win";
export type GameMode = "classic" | "minute" | "campaign";

export interface NoodleBoss {
  id: string;
  name: string;
  title: string;
  level: number;
  toughness: number;
  exp: number;
  coolingFactor: number;
  slurpFactor: number;
  palette: {
    bowl: string;
    bowlHi: string;
    bowlShadow: string;
    band: string;
    bandHi: string;
    noodle: string;
    noodleHi: string;
    strand: string;
    meat: string;
    accent: string;
    garnish: string;
  };
}

export interface GameState {
  mode: GameMode;
  phase: Phase;
  temperature: number; // starts 100, target 35
  targetTemp: number;
  noodle: number; // 100 -> 0
  bowls: number;
  campaignStage: number;
  totalStages: number;
  timeLimit: number | null;
  boss: NoodleBoss;
  combo: number;
  maxCombo: number;
  elapsed: number; // seconds since fight start
  blow: number; // smoothed 0..1 (O-mouth / 吹气)
  suck: number; // smoothed 0..1 (rounded lips / 吸面)
  acting: boolean; // currently blowing or sucking
  exp: number;
}

export interface FaceMetrics {
  blow: number; // 0..1
  suck: number; // 0..1
  hasFace: boolean;
}

export interface MetricsSource {
  get(): FaceMetrics;
}

export type ReportKind = "normal" | "crit" | "suck" | "combo";

export interface GameResult {
  name: string;
  mode: GameMode;
  time: number;
  maxCombo: number;
  bowls: number;
  stagesCleared: number;
  totalStages: number;
  rank: number;
  worldSize: number;
  beatPct: number;
  grade: string;
}
