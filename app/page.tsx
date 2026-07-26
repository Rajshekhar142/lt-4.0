import { getDomainsAction, getActiveEntryAction, getTodayTotalsAction } from "@/lib/actions";
import TrackerClient from "./tracker-client";

// This page reads live DB state on every request — never statically cache it.
export const dynamic = "force-dynamic";

export default async function Home() {
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
