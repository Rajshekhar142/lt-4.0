import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "./db";

export const SESSION_COOKIE = "session_token";

// Call this at the top of any protected server component. No user apart
// from the one seeded via ADMIN_EMAIL/ADMIN_PASSWORD will ever exist, but
// this doesn't hardcode that assumption anywhere — it just resolves
// whichever account the session cookie actually belongs to.
export async function requireUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = token ? getSessionUser(token) : null;

  if (!user) redirect("/login");
  return user;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? await getSessionUser(token) : null;
}