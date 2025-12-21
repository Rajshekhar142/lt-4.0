"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/db";
import { Domain, Task, TaskLog, GameSettings, DailyHistory } from "@/models/Core";
import { BADGES } from "@/lib/badgeRules";

// --- HELPER: Calculate Streak ---
function calculateStreak(logs: any[]) {
  if (!logs.length) return 0;
  const uniqueDates = Array.from(new Set(logs.map((l: any) => l.dateString))).sort().reverse();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let streak = 0;
  let currentCheck = today;

  if (!uniqueDates.includes(today)) {
    if (uniqueDates.includes(yesterday)) currentCheck = yesterday;
    else return 0;
  }

  for (const date of uniqueDates) {
    if (date === currentCheck) {
      streak++;
      const d = new Date(currentCheck);
      d.setDate(d.getDate() - 1);
      currentCheck = d.toISOString().split("T")[0] as string;
    }
  }
  return streak;
}

// --- MAIN: Fetch App Data (With Robust History Sync) ---
export async function getData() {
  await connectDB();
  const today = new Date().toISOString().split("T")[0]; 

  // 1. Ensure Settings Exist
  let settings = await GameSettings.findOne({ userEmail: "me" });
  if (!settings) {
    settings = await GameSettings.create({ userEmail: "me", isLocked: false, lockDate: today });
  }

  // 2. ROBUST HISTORY SYNC (The "Catch Up" Loop)
  // Find the LAST recorded history date
  const lastHistory = await DailyHistory.findOne().sort({ dateString: -1 });
  
  // If we have history, start checking from the day AFTER that. 
  // If no history, start from 30 days ago (or start of time).
  let checkDate = lastHistory 
    ? new Date(new Date(lastHistory.dateString).getTime() + 86400000) 
    : new Date(Date.now() - (30 * 86400000)); // Default check last 30 days if empty

  const now = new Date();

  // Loop through every day from 'checkDate' until 'Yesterday'
  while (checkDate < now) {
    const dateStr = checkDate.toISOString().split("T")[0];
    
    // Don't snapshot Today yet (it's still happening!)
    if (dateStr === today) break;

    // Check if we already have it (double safety)
    const exists = await DailyHistory.findOne({ dateString: dateStr });
    
    if (!exists) {
      // Calculate stats for that past day
      const logs = await TaskLog.find({ dateString: dateStr }).lean();
      const points = logs.reduce((acc: number, l: any) => acc + l.pointsEarned, 0);
      const count = logs.length;

      // Save History (Even if 0, so we know we checked it)
      await DailyHistory.create({
        userEmail: "me",
        dateString: dateStr,
        totalPoints: points,
        tasksCompleted: count
      });
    }
    
    // Move to next day
    checkDate.setDate(checkDate.getDate() + 1);
  }

  // 3. Auto-Unlock if date changed
  if (settings.lockDate !== today) {
     settings.isLocked = false;
     settings.lockDate = today;
     await settings.save();
  }

  // 4. Fetch Active Data
  const [domains, tasks, logs, finalSettings] = await Promise.all([
    Domain.find({ isActive: true }).sort({ order: 1 }).lean(),
    Task.find({ isActive: true }).lean(),
    TaskLog.find({ dateString: today }).lean(),
    GameSettings.findOne({ userEmail: "me" }).lean()
  ]);

  const isLocked = finalSettings?.isLocked === true && finalSettings?.lockDate === today;

  const cleanTasks = tasks.map((t: any) => ({
    ...t,
    _id: t._id.toString(),
    domainId: t.domainId.toString(),
    isCompleted: logs.some((l: any) => l.taskId.toString() === t._id.toString())
  }));

  const cleanDomains = domains.map((d: any) => ({
    ...d,
    _id: d._id.toString()
  }));

  return { domains: cleanDomains, tasks: cleanTasks, isLocked };
}

// --- LEGACY: Fetch Badges, Streak, Wallet & Progress ---
export async function getLegacyData() {
  await connectDB();
  
  const [logs, tasks, domains, settings] = await Promise.all([
    TaskLog.find({}).lean(),
    Task.find({}).lean(),
    Domain.find({}).lean(),
    GameSettings.findOne({ userEmail: "me" })
  ]);

  if (!settings) return { badges: [], streak: 0, earnedIds: [], wallet: 0, badgeProgress: {} };

  const currentStreak = calculateStreak(logs);
  const earnedBadgeIds = settings.earnedBadges || [];
  let newBadgesEarned = false;
  
  // NEW: Calculate Progress for every badge (locked or unlocked)
  const badgeProgress: Record<string, number> = {};

  for (const badge of BADGES) {
    let progress = 0;
    let qualified = false;

    if (badge.type === "streak") {
      progress = currentStreak;
      if (currentStreak >= badge.threshold) qualified = true;
    } 
    else if (badge.type === "domain_tasks") {
      const domain = domains.find((d: any) => d.name === badge.domainName);
      if (domain) {
        const domainTaskIds = tasks
            .filter((t: any) => t.domainId.toString() === domain._id.toString())
            .map((t: any) => t._id.toString());
        
        const count = logs.filter((l: any) => domainTaskIds.includes(l.taskId.toString())).length;
        progress = count;
        if (count >= badge.threshold) qualified = true;
      }
    }

    // Save progress for UI (clamp at 100%)
    badgeProgress[badge.id] = Math.min(100, Math.round((progress / badge.threshold) * 100));

    // Award Badge
    if (qualified && !earnedBadgeIds.includes(badge.id)) {
      earnedBadgeIds.push(badge.id);
      newBadgesEarned = true;
    }
  }

  if (newBadgesEarned) {
    settings.earnedBadges = earnedBadgeIds;
    await settings.save();
    revalidatePath("/");
  }

  return {
    streak: currentStreak,
    earnedIds: earnedBadgeIds,
    wallet: settings.walletBalance || 0, // Return Wallet
    badgeProgress // Return Progress Data
  };
}

// --- ACTION: Toggle Task (Updates Wallet) ---
export async function toggleTask(taskId: string, points: number) {
  await connectDB();
  const today = new Date().toISOString().split("T")[0];

  const existingLog = await TaskLog.findOne({ taskId, dateString: today });
  const settings = await GameSettings.findOne({ userEmail: "me" });

  if (existingLog) {
    // UNDO: Remove log, Subtract money
    await TaskLog.findByIdAndDelete(existingLog._id);
    if (settings) {
       settings.walletBalance = Math.max(0, (settings.walletBalance || 0) - points);
       await settings.save();
    }
  } else {
    // DO: Create log, Add money
    await TaskLog.create({ taskId, dateString: today, pointsEarned: points });
    if (settings) {
       settings.walletBalance = (settings.walletBalance || 0) + points;
       await settings.save();
    }
  }
  revalidatePath("/");
}

// --- ACTION: Reset Wallet (Cash Out) ---
export async function resetWallet() {
  await connectDB();
  await GameSettings.findOneAndUpdate({ userEmail: "me" }, { walletBalance: 0 });
  revalidatePath("/legacy");
}

// --- OTHER ACTIONS (Unchanged) ---
export async function addTask(text: string) { /* ... same as before ... */ }
export async function toggleLock() { /* ... same as before ... */ }
export async function deleteTask(taskId: string) { /* ... same as before ... */ }