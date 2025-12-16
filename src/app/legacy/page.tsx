import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { getLegacyData } from "@/app/actions";
import { BADGES } from "@/lib/badgeRules";
import { DailyHistory } from "@/models/Core"; // Import Model
import connectDB from "@/lib/db"; // Import DB connection

// NEW: Function to fetch history directly in this Server Component
async function getHistory() {
  await connectDB();
  // Get last 30 days, sorted new to old
  const history = await DailyHistory.find({ userEmail: "me" }).sort({ dateString: -1 }).limit(30).lean();
  return history;
}

export default async function LegacyPage() {
  const { streak, earnedIds } = await getLegacyData();
  const history = await getHistory(); // Fetch the history

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-20 w-full md:max-w-md md:mx-auto md:border-x border-neutral-800 overflow-x-hidden">
      
      {/* 1. Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link 
          href="/" 
          className="p-3 bg-neutral-900 rounded-full text-neutral-400 hover:text-white transition-colors border border-neutral-800"
        >
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold uppercase tracking-widest">Legacy Hall</h1>
      </div>

      {/* 2. Streak Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-3xl mb-10 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-black via-transparent to-transparent" />
        
        <h3 className="text-xs font-bold text-orange-100 uppercase tracking-[0.2em] mb-2 relative z-10">
          Current Streak
        </h3>
        
        <div className="text-5xl md:text-7xl font-black text-white relative z-10 drop-shadow-lg leading-tight">
          {streak}
        </div>
        
        <div className="text-lg font-medium text-orange-200 uppercase tracking-widest relative z-10 mt-1">
          Days
        </div>
      </div>

      {/* 3. NEW: Past Performance (History) */}
      <div className="mb-10">
         <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider pl-1 mb-3">
           Past Performance
         </h3>
         
         {history.length === 0 ? (
           <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/30 text-center">
             <p className="text-neutral-500 text-sm">No history recorded yet.</p>
           </div>
         ) : (
           <div className="grid grid-cols-2 gap-3">
             {history.map((day: any) => (
               <div key={day._id} className="bg-neutral-900/50 border border-neutral-800 p-4 rounded-2xl">
                 <p className="text-xs text-neutral-500 font-bold uppercase mb-1">{day.dateString}</p>
                 <p className="text-2xl font-black text-white">{day.totalPoints} <span className="text-xs font-medium text-neutral-400">pts</span></p>
                 <p className="text-[10px] text-neutral-600 font-medium">{day.tasksCompleted} tasks done</p>
               </div>
             ))}
           </div>
         )}
      </div>

      {/* 4. Badges List */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider pl-1">
          Achievements
        </h3>

        <div className="grid gap-3">
          {BADGES.map((badge) => {
            const isUnlocked = earnedIds.includes(badge.id);
            const Icon = badge.icon;

            return (
              <div 
                key={badge.id}
                className={`
                  flex items-center gap-4 p-4 rounded-2xl border transition-all
                  ${isUnlocked 
                    ? "bg-neutral-900 border-neutral-800" 
                    : "bg-neutral-900/30 border-neutral-900 opacity-60 grayscale"
                  }
                `}
              >
                <div 
                  className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center shadow-lg border border-white/10 ${isUnlocked ? "animate-pulse" : "bg-neutral-800"}`}
                  style={{ backgroundColor: isUnlocked ? badge.color : undefined }}
                >
                   {isUnlocked ? <Icon size={20} className="text-white" /> : <Lock size={18} className="text-neutral-500" />}
                </div>

                <div>
                  <h4 className={`font-bold text-sm ${isUnlocked ? "text-white" : "text-neutral-500"}`}>
                    {badge.name}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {badge.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
    </main>
  );
}