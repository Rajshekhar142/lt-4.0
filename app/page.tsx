import { getDomainsAction, getActiveEntryAction, getTodayTotalsAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import LandingPage from "@/components/LandingPage";
import TrackerClient from "./tracker-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <LandingPage />;

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