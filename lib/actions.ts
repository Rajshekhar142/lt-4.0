"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as db from "./db";
import { SESSION_COOKIE } from "./auth";

export type LoginState = { error: string | null };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = db.verifyPassword(email, password);
  if (!user) {
    return { error: "Incorrect email or password." };
  }

  const token = db.createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) db.deleteSession(token);
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}

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

export async function stopEntryAction(
  entryId: number,
  description: string = "",
  frr: number | null = null,
  tag: string | null = null   // NEW
) {
  const entry = db.stopEntry(entryId, description, frr, tag);
  revalidatePath("/");
  revalidatePath("/history");
  return entry;
}

export async function setPoaAction(entryId: number, poa: string | null) {
  const entry = db.setEntryPoa(entryId, poa);
  revalidatePath("/");
  revalidatePath("/history");
  return entry;
}

export async function setFlowMetaAction(
  entryId: number,
  endReason: db.EndReason | null,
  flowRating: number | null
) {
  const entry = db.setEntryFlowMeta(entryId, endReason, flowRating);
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

export async function getAnalyticsAction() {
  return db.getAnalytics();
}
export async function getPriorityQuadrantAction(days: number = 30) {
  return db.getPriorityQuadrant(days);
}

export async function getPrimeFocusAction() {
  return db.getPrimeFocus();
}

export async function setPrimeFocusAction(text: string | null) {
  db.setPrimeFocus(text);
  revalidatePath("/");
  return text;
}