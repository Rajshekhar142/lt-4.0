import { requireUser } from "@/lib/auth";
import { getKnowledgeTreeDataAction, getMockScoresAction } from "@/lib/analytics/actions";
import KnowledgeTree from "@/components/analytics/KnowledgeTree";
import DrillLogger from "@/components/analytics/DrillLogger";
import MockScoreGraph from "@/components/analytics/MockScoreGraph";

export default async function AnalyticsPage() {
  await requireUser();

  const [treeData, mockScores] = await Promise.all([
    getKnowledgeTreeDataAction(),
    getMockScoresAction(),
  ]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full gap-4 p-6">
      {/* Left Column: Knowledge Tree */}
      <div className="w-1/2 rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col">
        <h2 className="text-sm font-semibold text-zinc-300 mb-2">Knowledge Tree</h2>
        <div className="flex-1 w-full h-full min-h-[500px]">
          <KnowledgeTree treeData={treeData} />
        </div>
      </div>

      {/* Right Column: Drills & Mock Logger + Score Graph */}
      <div className="flex w-1/2 flex-col gap-4">
        <div className="h-56 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <DrillLogger />
        </div>
        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <MockScoreGraph mocks={mockScores} />
        </div>
      </div>
    </div>
  );
}