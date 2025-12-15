import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { getLegacyData } from "@/app/actions";
import { BADGES } from "@/lib/badgeRules";

export default async function LegacyPage() {
  const { streak, earnedIds } = await getLegacyData();

  return (
    // FIX: Added w-full, overflow-x-hidden
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
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-3xl mb-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-black via-transparent to-transparent" />
        
        <h3 className="text-xs font-bold text-orange-100 uppercase tracking-[0.2em] mb-2 relative z-10">
          Current Streak
        </h3>
        
        {/* FIX: Downsized font from 7xl to 5xl for mobile */}
        <div className="text-5xl md:text-7xl font-black text-white relative z-10 drop-shadow-lg leading-tight">
          {streak}
        </div>
        
        <div className="text-lg font-medium text-orange-200 uppercase tracking-widest relative z-10 mt-1">
          Days
        </div>
      </div>

      {/* 3. Badges List */}
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