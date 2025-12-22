import Link from "next/link";
import { ArrowLeft, Lock, Coins, RotateCcw } from "lucide-react";
import { getLegacyData, resetWallet } from "@/app/actions";
import { BADGES } from "@/lib/badgeRules";
import { DailyHistory } from "@/models/Core";
import connectDB from "@/lib/db";

// Fetch last 7 days (Newest First)
async function getHistory() {
  await connectDB();
  return DailyHistory.find({ userEmail: "me" })
    .sort({ dateString: -1 })
    .limit(7)
    .lean();
}

export default async function LegacyPage() {
  const { streak, earnedIds, wallet, badgeProgress } = await getLegacyData();
  const rawHistory = await getHistory();
  const progressMap = badgeProgress as Record<string, number>;

  // PREPARE CHART DATA
  // 1. Reverse to get chronological order (Oldest -> Newest)
  const chartData = [...rawHistory].reverse();
  
  // 2. Find Max Value for scaling (min 10 to avoid flatline on 0)
  const maxVal = Math.max(...chartData.map((d: any) => d.totalPoints), 10);
  
  // 3. Chart Dimensions
  const height = 100;
  const width = 100; // using percent-like coordinates
  
  // 4. Generate SVG Points
  // We map the 7 days to x coordinates (0, 16.6, 33.3, ... 100)
  const points = chartData.map((d: any, i: number) => {
    const x = (i / (Math.max(chartData.length - 1, 1))) * width;
    const y = height - (d.totalPoints / maxVal) * height; // Invert Y because SVG 0 is top
    return `${x},${y}`;
  }).join(" ");

  // 5. Generate Fill Area (Line + corners down to bottom)
  const fillPath = `${points} ${width},${height} 0,${height}`;

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-20 w-full md:max-w-md md:mx-auto md:border-x border-neutral-800 overflow-x-hidden">
      
      {/* 1. Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          href="/" 
          className="p-3 bg-neutral-900 rounded-full text-neutral-400 hover:text-white transition-colors border border-neutral-800"
        >
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold uppercase tracking-widest">Legacy Hall</h1>
      </div>

      {/* 2. THE WALLET */}
      <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-3xl mb-6 flex items-center justify-between">
         <div>
           <div className="flex items-center gap-2 mb-1">
             <Coins size={16} className="text-yellow-500" />
             <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Rewards Bank</h3>
           </div>
           <div className="text-4xl font-black text-white">{wallet || 0} <span className="text-sm font-medium text-neutral-500">pts</span></div>
         </div>
         
         <form action={resetWallet}>
           <button 
             className="p-3 bg-neutral-800 text-neutral-400 rounded-full hover:bg-red-900/20 hover:text-red-500 transition-colors"
             title="Cash Out (Reset to 0)"
           >
             <RotateCcw size={20} />
           </button>
         </form>
      </div>

      {/* 3. Streak Banner */}
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

      {/* 4. PERFORMANCE CHART (NEW) */}
      <div className="mb-10">
         <div className="flex justify-between items-end mb-4 px-2">
            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
              Last 7 Days
            </h3>
            {chartData.length > 0 && (
                <span className="text-xs font-mono text-green-500">
                    ▲ {chartData[chartData.length - 1].totalPoints} pts
                </span>
            )}
         </div>

         <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6 h-48 relative overflow-hidden">
             {chartData.length < 2 ? (
                <div className="h-full flex items-center justify-center text-neutral-600 text-sm italic">
                    Not enough data for chart
                </div>
             ) : (
                <div className="w-full h-full relative">
                    {/* SVG Container */}
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        
                        {/* Gradient Definition */}
                        <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ea580c" stopOpacity="0.5" />
                                <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* Area Fill */}
                        <polygon 
                           points={fillPath} 
                           fill="url(#chartGradient)" 
                        />

                        {/* The Line */}
                        <polyline 
                           points={points} 
                           fill="none" 
                           stroke="#ea580c" 
                           strokeWidth="3" 
                           vectorEffect="non-scaling-stroke"
                           strokeLinecap="round"
                           strokeLinejoin="round"
                        />
                        
                        {/* Dots on points */}
                        {chartData.map((d: any, i: number) => {
                             const x = (i / (chartData.length - 1)) * width;
                             const y = height - (d.totalPoints / maxVal) * height;
                             return (
                                <circle 
                                    key={i} 
                                    cx={x} 
                                    cy={y} 
                                    r="3" // Radius in svg units (small)
                                    className="fill-white"
                                    vectorEffect="non-scaling-stroke" // Keeps dot crisp
                                />
                             );
                        })}

                    </svg>

                    {/* Simple Date Labels on X-Axis */}
                    <div className="absolute bottom-0 left-0 w-full flex justify-between text-[10px] text-neutral-600 font-mono mt-2 transform translate-y-4">
                        {chartData.map((d: any, i: number) => (
                            <span key={i}>{d.dateString.slice(8)}</span> // Show only '25' from '2023-10-25'
                        ))}
                    </div>
                </div>
             )}
         </div>
      </div>

      {/* 5. Achievements */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider pl-1">
          Achievements
        </h3>

        <div className="grid gap-3">
          {BADGES.map((badge) => {
            const isUnlocked = earnedIds.includes(badge.id);
            const Icon = badge.icon;
            const progress = progressMap ? (progressMap[badge.id] || 0) : 0;

            return (
              <div 
                key={badge.id}
                className={`
                  relative overflow-hidden p-4 rounded-2xl border transition-all
                  ${isUnlocked 
                    ? "bg-neutral-900 border-neutral-800" 
                    : "bg-neutral-900/30 border-neutral-900"
                  }
                `}
              >
                <div className="relative z-10 flex items-center gap-4">
                  <div 
                    className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center shadow-lg border border-white/10 ${isUnlocked ? "animate-pulse" : "bg-neutral-800"}`}
                    style={{ backgroundColor: isUnlocked ? badge.color : undefined }}
                  >
                     {isUnlocked ? <Icon size={20} className="text-white" /> : <Lock size={18} className="text-neutral-500" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className={`font-bold text-sm ${isUnlocked ? "text-white" : "text-neutral-500"}`}>
                            {badge.name}
                        </h4>
                        {!isUnlocked && <span className="text-[10px] font-bold text-neutral-600">{progress}%</span>}
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-2">
                        {badge.description}
                    </p>
                    
                    {!isUnlocked && (
                        <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-neutral-600 transition-all duration-500" 
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}