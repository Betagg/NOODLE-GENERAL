import { findNoodleBoss } from "./noodles";
import type { NoodleBoss } from "./types";

export interface CampaignStage {
  bossId: string;
  title: string;
  briefing: string;
  levelBonus: number;
  toughnessBonus: number;
  expBonus: number;
  coolingFactor: number;
  slurpFactor: number;
}

export const CAMPAIGN_STAGES: CampaignStage[] = [
  {
    bossId: "hongshao",
    title: "前哨热汤",
    briefing: "先拿红烧祭旗，别让汤底看出你紧张。",
    levelBonus: 0,
    toughnessBonus: 0,
    expBonus: 0,
    coolingFactor: 1,
    slurpFactor: 1,
  },
  {
    bossId: "suancai",
    title: "酸雾伏击",
    briefing: "酸菜军师开坛，嘴型要稳，胃要淡定。",
    levelBonus: 1,
    toughnessBonus: 5,
    expBonus: 18,
    coolingFactor: 0.94,
    slurpFactor: 0.98,
  },
  {
    bossId: "paojiao",
    title: "泡椒奇袭",
    briefing: "辣意先到，面还没投降。",
    levelBonus: 2,
    toughnessBonus: 10,
    expBonus: 34,
    coolingFactor: 0.88,
    slurpFactor: 0.94,
  },
  {
    bossId: "xiangla",
    title: "红油鏖战",
    briefing: "这一关开始，泡面也有脾气了。",
    levelBonus: 3,
    toughnessBonus: 16,
    expBonus: 52,
    coolingFactor: 0.82,
    slurpFactor: 0.9,
  },
  {
    bossId: "laotan",
    title: "老坛终局",
    briefing: "坛中魔王亲征，赢了就是夜宵史书。",
    levelBonus: 5,
    toughnessBonus: 24,
    expBonus: 88,
    coolingFactor: 0.76,
    slurpFactor: 0.84,
  },
];

export function makeCampaignBoss(stageIndex: number): NoodleBoss {
  const stage = CAMPAIGN_STAGES[Math.min(stageIndex, CAMPAIGN_STAGES.length - 1)];
  const base = findNoodleBoss(stage.bossId);

  return {
    ...base,
    title: stage.title,
    level: base.level + stage.levelBonus,
    toughness: base.toughness + stage.toughnessBonus,
    exp: base.exp + stage.expBonus,
    coolingFactor: base.coolingFactor * stage.coolingFactor,
    slurpFactor: base.slurpFactor * stage.slurpFactor,
  };
}
