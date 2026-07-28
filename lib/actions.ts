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
    // TODO: flip to true once the EC2 deploy is behind real HTTPS
    // (certbot + a domain) — with plain http://, secure cookies never
    // get sent at all and login would silently break.
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days, matches SESSION_DURATION_MS in db.ts
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

export async function stopEntryAction(entryId: number, description: string = "") {
  const entry = db.stopEntry(entryId, description);
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
