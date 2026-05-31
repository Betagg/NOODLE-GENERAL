import type { GameResult } from "./types";

const KEY = "noodle-wars-lb-v1";
const MINUTE_KEY = "paomian-jiangjun-minute-lb-v1";
const CAMPAIGN_KEY = "paomian-jiangjun-campaign-lb-v1";
const WORLD_BASE = 8800; // synthetic world population so ranks feel "real"

export interface Entry {
  name: string;
  time: number;
}

export interface MinuteEntry {
  name: string;
  bowls: number;
  maxCombo: number;
  time: number;
}

export interface CampaignEntry {
  name: string;
  stagesCleared: number;
  totalStages: number;
  maxCombo: number;
  time: number;
}

export function getTop(n = 8): Entry[] {
  return load().slice(0, n);
}

export function getMinuteTop(n = 8): MinuteEntry[] {
  return loadMinute().slice(0, n);
}

export function getCampaignTop(n = 8): CampaignEntry[] {
  return loadCampaign().slice(0, n);
}

function load(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const arr = JSON.parse(raw) as Entry[];
    return arr.sort((a, b) => a.time - b.time);
  } catch {
    return seed();
  }
}

// Pre-populate with a few "rival" times the first time around.
function seed(): Entry[] {
  const rivals: Entry[] = [
    { name: "面神·阿强", time: 8.42 },
    { name: "吸面王", time: 10.91 },
    { name: "老坛克星", time: 13.5 },
    { name: "Lv99村民", time: 16.77 },
    { name: "吹面学徒", time: 22.3 },
  ];
  localStorage.setItem(KEY, JSON.stringify(rivals));
  return rivals;
}

function loadMinute(): MinuteEntry[] {
  try {
    const raw = localStorage.getItem(MINUTE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MinuteEntry[];
    return arr.sort(sortMinuteEntries);
  } catch {
    return [];
  }
}

function loadCampaign(): CampaignEntry[] {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CampaignEntry[];
    return arr.sort(sortCampaignEntries);
  } catch {
    return [];
  }
}

// % of (synthetic) world players you beat — a logistic curve over time.
export function beatPercent(time: number): number {
  const median = 17;
  const spread = 6.5;
  const p = 1 / (1 + Math.exp((time - median) / spread));
  return Math.max(1, Math.min(99, Math.round(p * 100)));
}

export function grade(beatPct: number): string {
  if (beatPct >= 97) return "至尊泡面之神";
  if (beatPct >= 88) return "吹面将军";
  if (beatPct >= 70) return "吹面校尉";
  if (beatPct >= 45) return "泡面什长";
  return "泡面新兵";
}

export function submitScore(time: number, maxCombo: number, name = "Beta"): GameResult {
  const list = load();
  list.push({ name, time });
  list.sort((a, b) => a.time - b.time);
  const trimmed = list.slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(trimmed));

  const beatPct = beatPercent(time);
  const worldSize = WORLD_BASE + trimmed.length;
  const rank = Math.max(1, Math.round((1 - beatPct / 100) * worldSize) + 1);

  return {
    name,
    mode: "classic",
    time,
    maxCombo,
    bowls: 1,
    stagesCleared: 1,
    totalStages: 1,
    rank,
    worldSize,
    beatPct,
    grade: grade(beatPct),
  };
}

export function submitMinuteScore(
  time: number,
  maxCombo: number,
  bowls: number,
  name = "Beta",
): GameResult {
  const list = loadMinute();
  list.push({ name, bowls, maxCombo, time });
  list.sort(sortMinuteEntries);
  const trimmed = list.slice(0, 20);
  localStorage.setItem(MINUTE_KEY, JSON.stringify(trimmed));

  const beatPct = minuteBeatPercent(bowls);
  const worldSize = WORLD_BASE + trimmed.length;
  const rank = Math.max(1, Math.round((1 - beatPct / 100) * worldSize) + 1);

  return {
    name,
    mode: "minute",
    time,
    maxCombo,
    bowls,
    stagesCleared: bowls,
    totalStages: 0,
    rank,
    worldSize,
    beatPct,
    grade: minuteGrade(bowls),
  };
}

export function submitCampaignScore(
  time: number,
  maxCombo: number,
  stagesCleared: number,
  totalStages: number,
  name = "Beta",
): GameResult {
  const list = loadCampaign();
  list.push({ name, stagesCleared, totalStages, maxCombo, time });
  list.sort(sortCampaignEntries);
  const trimmed = list.slice(0, 20);
  localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(trimmed));

  const beatPct = campaignBeatPercent(stagesCleared, totalStages, time);
  const worldSize = WORLD_BASE + trimmed.length;
  const rank = Math.max(1, Math.round((1 - beatPct / 100) * worldSize) + 1);

  return {
    name,
    mode: "campaign",
    time,
    maxCombo,
    bowls: stagesCleared,
    stagesCleared,
    totalStages,
    rank,
    worldSize,
    beatPct,
    grade: campaignGrade(stagesCleared, totalStages, time),
  };
}

function sortMinuteEntries(a: MinuteEntry, b: MinuteEntry) {
  return b.bowls - a.bowls || b.maxCombo - a.maxCombo || a.time - b.time;
}

function sortCampaignEntries(a: CampaignEntry, b: CampaignEntry) {
  return b.stagesCleared - a.stagesCleared || a.time - b.time || b.maxCombo - a.maxCombo;
}

function minuteBeatPercent(bowls: number) {
  if (bowls <= 0) return 8;
  if (bowls === 1) return 35;
  if (bowls === 2) return 62;
  if (bowls === 3) return 82;
  if (bowls === 4) return 93;
  if (bowls === 5) return 97;
  return 99;
}

function minuteGrade(bowls: number) {
  if (bowls <= 0) return "空碗参谋";
  if (bowls === 1) return "一碗续命兵";
  if (bowls === 2) return "夜宵校尉";
  if (bowls === 3) return "吸面都尉";
  if (bowls === 4) return "泡面将军";
  if (bowls === 5) return "速食暴君";
  return "一分钟面王";
}

function campaignBeatPercent(stagesCleared: number, totalStages: number, time: number) {
  if (stagesCleared <= 0) return 6;
  const progress = stagesCleared / Math.max(1, totalStages);
  let pct = 12 + progress * 72;
  if (stagesCleared >= totalStages) pct += 10;
  if (stagesCleared >= totalStages && time <= 95) pct += 5;
  if (stagesCleared >= totalStages && time <= 75) pct += 4;
  return Math.max(8, Math.min(99, Math.round(pct)));
}

function campaignGrade(stagesCleared: number, totalStages: number, time: number) {
  if (stagesCleared <= 0) return "锅边候补";
  if (stagesCleared === 1) return "泡面伍长";
  if (stagesCleared === 2) return "汤面校尉";
  if (stagesCleared === 3) return "夜宵都督";
  if (stagesCleared === 4) return "速食将军";
  if (stagesCleared >= totalStages && time <= 75) return "三分钟灭面王";
  if (stagesCleared >= totalStages && time <= 95) return "铁肺大将军";
  return "泡面大元帅";
}
