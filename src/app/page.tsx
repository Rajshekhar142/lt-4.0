import Link from "next/link"; // Import Link
import { getData } from "./actions"; // Removed getLegacyData
import DomainSection from "@/components/DomainSection";
import VoiceCommander from "@/components/VoiceCommander";
import RadarChart from "@/components/RadarChart";
import { Trophy, Lock, Unlock } from "lucide-react"; // Import Trophy icon directly
import { toggleLock } from "./actions";

export default async function Home() {
  const { domains, tasks, isLocked } = await getData(); // Only fetching tasks now
  
  const totalPoints = tasks.reduce((acc: number, t: any) => acc + t.points, 0);
  const earnedPoints = tasks.filter((t: any) => t.isCompleted).reduce((acc: number, t: any) => acc + t.points, 0);

  return (
<main className="min-h-screen bg-black pb-32 w-full md:max-w-md md:mx-auto md:border-x border-neutral-800 relative overflow-x-hidden">
      
      <header className="bg-black/80 backdrop-blur-md p-6 pb-2 sticky top-0 z-20 border-b border-neutral-800">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">Today</h1>
          
          <div className="flex items-center gap-3">
             <Link 
               href="/legacy"
               className="p-2 bg-neutral-900 rounded-full text-yellow-500 hover:text-yellow-400 transition-colors border border-neutral-800 shadow-sm"
             >
               <Trophy size={20} />
             </Link>

             <form action={toggleLock}>
               <button className="p-2 bg-neutral-900 rounded-full text-neutral-400 hover:text-white transition-colors border border-neutral-800">
                 {isLocked ? <Lock size={20} className="text-red-500"/> : <Unlock size={20} />}
               </button>
             </form>

             <div className="text-right pl-1">
               <span className="text-xl font-bold text-white">{earnedPoints}</span>
               <span className="text-xs font-bold text-neutral-600"> / {totalPoints}</span>
             </div>
          </div>
        </div>
      </header>

      {/* Radar */}
      <div className="border-b border-neutral-800 bg-neutral-900/10 mb-4 py-4 overflow-hidden">
        <RadarChart domains={domains} tasks={tasks} />
      </div>

      {/* List */}
      <div className="p-4 space-y-4"> {/* Reduced padding from p-5 to p-4 for better fit */}
        {domains.map((domain: any) => {
          const domainTasks = tasks.filter((t: any) => t.domainId === domain._id);
          return <DomainSection key={domain._id} domain={domain} tasks={domainTasks} isLocked={isLocked}/>;
        })}
      </div>

      {!isLocked && <VoiceCommander />}
    </main>
  );
}