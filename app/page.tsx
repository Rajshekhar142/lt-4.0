import { getDomainsAction, getActiveEntryAction, getTodayTotalsAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import TrackerClient from "./tracker-client";

// This page reads live DB state on every request — never statically cache it.
export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser(); // redirects to /login if there's no valid session

  const [domains, activeEntry, todayTotals] = await Promise.all([
    getDomainsAction(),
    getActiveEntryAction(),
    getTodayTotalsAction(),
  ]);

  return (
    <TrackerClient
      domains={domains}
      initialActiveEntry={activeEntry}
      initialTodayTotals={todayTotals}
    />
  );
}