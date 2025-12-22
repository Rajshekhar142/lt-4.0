"use server";

import { revalidatePath } from "next/cache";
// NEW: Import unstable_noStore to kill the cache
import { unstable_noStore as noStore } from "next/cache"; 
import connectDB from "@/lib/db";
import { Domain, Task, TaskLog, GameSettings, DailyHistory } from "@/models/Core";
import { BADGES } from "@/lib/badgeRules";

// --- HELPER: Global Date Source of Truth ---
// This ensures we always use 5:30 AM IST (UTC Midnight) as the flip switch
function getTodayDateString() {
  // Returns "YYYY-MM-DD" based on UTC (which is 5:30 AM IST)
  return new Date().toISOString().split("T")[0];
}

function getYesterdayDateString() {
  const date = new Date();
  date.setDate(date.getDate() - 1); // Subtract 24 hours
  return date.toISOString().split("T")[0];
}

// --- HELPER: Calculate Streak ---
function calculateStreak(logs: any[]) {
  if (!logs.length) return 0;
  const uniqueDates = Array.from(new Set(logs.map((l: any) => l.dateString))).sort().reverse();
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

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

// --- MAIN: Fetch App Data ---
export async function getData() {
  // CRITICAL: Forces this function to run fresh every time (Fixes the bug)
  noStore(); 
  
  await connectDB();
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // 1. Ensure Settings Exist
  let settings = await GameSettings.findOne({ userEmail: "me" });
  if (!settings) {
    settings = await GameSettings.create({ userEmail: "me", isLocked: false, lockDate: today });
  }

  // 2. HISTORY SYNC LOOP (Fixes "Missing Past Performance")
  // We check from the last saved history up to yesterday.
  const lastHistory = await DailyHistory.findOne().sort({ dateString: -1 });
  
  // Start checking from the day AFTER the last history, OR from 30 days ago if empty
  let checkDate = lastHistory 
    ? new Date(new Date(lastHistory.dateString).getTime() + 86400000) 
    : new Date(Date.now() - (30 * 86400000));

  const now = new Date();

  // Loop until we reach Today (exclusive)
  while (checkDate.toISOString().split("T")[0] < today) {
    const dateStr = checkDate.toISOString().split("T")[0];
    
    // Check if history exists for this specific date
    const exists = await DailyHistory.findOne({ dateString: dateStr });
    
    if (!exists) {
      // Calculate stats for that past day
      const logs = await TaskLog.find({ dateString: dateStr }).lean();
      const points = logs.reduce((acc: number, l: any) => acc + l.pointsEarned, 0);
      const count = logs.length;

      // Save History (Even if 0, so we have a record that the day passed)
      await DailyHistory.create({
        userEmail: "me",
        dateString: dateStr,
        totalPoints: points,
        tasksCompleted: count
      });
      console.log(`[Auto-History] Saved snapshot for ${dateStr}`);
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
    TaskLog.find({ dateString: today }).lean(), // Only fetch logs for TODAY
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
  noStore(); // Force fresh data here too
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
  
  // Progress Calculation
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

    badgeProgress[badge.id] = Math.min(100, Math.round((progress / badge.threshold) * 100));

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
    wallet: settings.walletBalance || 0,
    badgeProgress
  };
}

// ... (Keep toggleTask, resetWallet, addTask, toggleLock, deleteTask EXACTLY as they were) ...
// Copy them from the previous version, they don't need changes.
// Just make sure to import toggleTask etc at the bottom of the file if they were cut off.
export async function toggleTask(taskId: string, points: number) {
  await connectDB();
  const today = getTodayDateString(); // Use helper

  const existingLog = await TaskLog.findOne({ taskId, dateString: today });
  const settings = await GameSettings.findOne({ userEmail: "me" });

  if (existingLog) {
    await TaskLog.findByIdAndDelete(existingLog._id);
    if (settings) {
       settings.walletBalance = Math.max(0, (settings.walletBalance || 0) - points);
       await settings.save();
    }
  } else {
    await TaskLog.create({ taskId, dateString: today, pointsEarned: points });
    if (settings) {
       settings.walletBalance = (settings.walletBalance || 0) + points;
       await settings.save();
    }
  }
  revalidatePath("/");
}

export async function resetWallet() {
  await connectDB();
  await GameSettings.findOneAndUpdate({ userEmail: "me" }, { walletBalance: 0 });
  revalidatePath("/legacy");
}

export async function addTask(text: string) {
  await connectDB();
  const lowerText = text.toLowerCase();
  const pointsMatch = lowerText.match(/(\d+)\s*(?:pt|point|pts)/);
  const points = pointsMatch ? parseInt(pointsMatch[1]) : 1; 
  const domains = await Domain.find({ isActive: true }).lean();
  let targetDomain = domains.find((d: any) => lowerText.includes(d.name.toLowerCase()));
  if (!targetDomain) targetDomain = domains[0]; 

  let cleanTitle = text
    .replace(new RegExp(`${points}\\s*(?:pt|point|pts)[s]?`, 'gi'), "") 
    .replace(new RegExp(targetDomain?.name || "", 'gi'), "") 
    .trim();

  await Task.create({
    domainId: targetDomain?._id,
    title: cleanTitle || "New Task", 
    points: points,
    isActive: true
  });
  revalidatePath("/");
  return { success: true };
}

export async function toggleLock() {
  await connectDB();
  const today = getTodayDateString(); // Use helper
  let settings = await GameSettings.findOne({ userEmail: "me" });
  
  if (!settings) {
    await GameSettings.create({ userEmail: "me", isLocked: true, lockDate: today });
  } else {
    const newLockState = !settings.isLocked;
    settings.isLocked = newLockState;
    if (newLockState) settings.lockDate = today;
    await settings.save();
  }
  revalidatePath("/");
}

export async function deleteTask(taskId: string) {
  await connectDB();
  await Task.findByIdAndDelete(taskId);
  await TaskLog.deleteMany({ taskId });
  revalidatePath("/");
}