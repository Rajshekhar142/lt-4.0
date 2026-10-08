"use server";

import { revalidatePath } from "next/cache";
import * as analyticsDb from "./db";

const DECAY_FACTOR = 0.85;
const MIN_ACTIVATION_ATTEMPTS = 15;

export type NodeMastery = {
  topic_id: string;
  section: "VARC" | "DILR" | "QA";
  raw_attempted: number;
  raw_correct: number;
  weighted_accuracy: number; // 0 to 1
  is_activated: boolean;
  tier: "locked" | "bronze" | "silver" | "gold";
};

export async function logDrillAction(
  topicId: string,
  section: "VARC" | "DILR" | "QA",
  attempted: number,
  correct: number
) {
  if (attempted <= 0 || correct < 0 || correct > attempted) {
    throw new Error("Invalid drill values");
  }
  analyticsDb.logDrill(topicId, section, attempted, correct);
  revalidatePath("/analytics");
}

export async function logMockAction(
  mockName: string,
  examDate: string,
  varc: number,
  dilr: number,
  qa: number
) {
  analyticsDb.logMock(mockName, examDate, varc, dilr, qa);
  revalidatePath("/analytics");
}

export async function getMockScoresAction() {
  return analyticsDb.getMocks();
}

export async function getKnowledgeTreeDataAction(): Promise<Record<string, NodeMastery>> {
  const allDrills = analyticsDb.getAllDrills();

  // Group drills by topic
  const grouped = new Map<string, analyticsDb.DrillRecord[]>();
  for (const d of allDrills) {
    const list = grouped.get(d.topic_id) ?? [];
    list.push(d);
    grouped.set(d.topic_id, list);
  }

  const result: Record<string, NodeMastery> = {};

  for (const [topicId, drills] of grouped.entries()) {
    const n = drills.length;
    let weightedCorrect = 0;
    let weightedAttempts = 0;
    let rawAttempted = 0;
    let rawCorrect = 0;

    for (let idx = 0; idx < n; idx++) {
      const i = idx + 1; // 1-indexed session
      const decay = Math.pow(DECAY_FACTOR, n - i);
      weightedCorrect += drills[idx].correct * decay;
      weightedAttempts += drills[idx].attempted * decay;
      rawAttempted += drills[idx].attempted;
      rawCorrect += drills[idx].correct;
    }

    const accuracy = weightedAttempts > 0 ? weightedCorrect / weightedAttempts : 0;
    const isActivated = rawAttempted >= MIN_ACTIVATION_ATTEMPTS;

    let tier: NodeMastery["tier"] = "locked";
    if (accuracy >= 0.9) tier = "gold";
    else if (accuracy >= 0.8) tier = "silver";
    else if (accuracy >= 0.6) tier = "bronze";

    result[topicId] = {
      topic_id: topicId,
      section: drills[0].section,
      raw_attempted: rawAttempted,
      raw_correct: rawCorrect,
      weighted_accuracy: accuracy,
      is_activated: isActivated,
      tier,
    };
  }

  return result;
}
