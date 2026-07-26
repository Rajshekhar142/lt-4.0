"use server";

import { revalidatePath } from "next/cache";
import * as db from "./db";

export async function getDomainsAction() {
  return db.getDomains();
}

export async function getActiveEntryAction() {
  return db.getActiveEntry();
}

export async function startEntryAction(domainId: number) {
  const entry = db.startEntry(domainId);
  revalidatePath("/");
  revalidatePath("/history");
  return entry;
}

export async function stopEntryAction(entryId: number) {
  const entry = db.stopEntry(entryId);
  revalidatePath("/");
  revalidatePath("/history");
  return entry;
}

export async function getHistoryAction(days: number = 30) {
  return db.getHistory(days);
}

export async function getTodayTotalsAction() {
  return db.getTodayTotals();
}
