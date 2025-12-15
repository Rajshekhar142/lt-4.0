"use server";

import { revalidatePath } from "next/cache";
import connectDB from "@/lib/db";
import { Domain, Task, TaskLog, GameSettings } from "@/models/Core";
import { BADGES } from "@/lib/badgeRules";

// --- HELPER: Calculate Streak ---
function calculateStreak(logs: any[]) {
  if (!logs.length) return 0;
  
  // Get unique dates from logs, sorted descending (newest first)
  const uniqueDates = Array.from(new Set(logs.map((l: any) => l.dateString))).sort().reverse();
  
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  let streak = 0;
  let currentCheck = today;

  // If no log today, check if streak is alive from yesterday
  if (!uniqueDates.includes(today)) {
    if (uniqueDates.includes(yesterday)) {
      currentCheck = yesterday;
    } else {
      return 0; // Streak broken
    }
  }

  // Count backwards
  for (const date of uniqueDates) {
    if (date === currentCheck) {
      streak++;
      // Move currentCheck back 1 day
      const d = new Date(currentCheck);
      d.setDate(d.getDate() - 1);
      currentCheck = d.toISOString().split("T")[0] as string;
    }
  }
  return streak;
}

// --- MAIN: Fetch App Data ---
export async function getData() {
  await connectDB();
  const today = new Date().toISOString().split("T")[0]; 

  const [domains, tasks, logs, settings] = await Promise.all([
    Domain.find({ isActive: true }).sort({ order: 1 }).lean(),
    Task.find({ isActive: true }).lean(),
    TaskLog.find({ dateString: today }).lean(),
    GameSettings.findOne({ userEmail: "me" }).lean()
  ]);

  // Check Lock Status
  const isLocked = settings?.isLocked === true && settings?.lockDate === today;

  // Transform Data
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

// --- LEGACY: Fetch Badges & Streak ---
export async function getLegacyData() {
  await connectDB();
  
  const [logs, tasks, domains, settings] = await Promise.all([
    TaskLog.find({}).lean(),
    Task.find({}).lean(),
    Domain.find({}).lean(),
    GameSettings.findOne({ userEmail: "me" })
  ]);

  // If no settings yet, return defaults
  if (!settings) return { badges: [], streak: 0, earnedIds: [] };

  const currentStreak = calculateStreak(logs);
  const earnedBadgeIds = settings.earnedBadges || [];
  let newBadgesEarned = false;

  // Check Logic for each badge
  for (const badge of BADGES) {
    if (earnedBadgeIds.includes(badge.id)) continue; 

    let qualified = false;

    if (badge.type === "streak") {
      if (currentStreak >= badge.threshold) qualified = true;
    } 
    else if (badge.type === "domain_tasks") {
      const domain = domains.find((d: any) => d.name === badge.domainName);
      if (domain) {
        const domainTaskIds = tasks
            .filter((t: any) => t.domainId.toString() === domain._id.toString())
            .map((t: any) => t._id.toString());
        
        const count = logs.filter((l: any) => domainTaskIds.includes(l.taskId.toString())).length;
        if (count >= badge.threshold) qualified = true;
      }
    }

    if (qualified) {
      earnedBadgeIds.push(badge.id);
      newBadgesEarned = true;
    }
  }

  // Save new badges if found
  if (newBadgesEarned) {
    settings.earnedBadges = earnedBadgeIds;
    await settings.save();
    revalidatePath("/");
  }

  return {
    streak: currentStreak,
    earnedIds: earnedBadgeIds
  };
}

// --- ACTIONS ---

export async function toggleTask(taskId: string, points: number) {
  await connectDB();
  const today = new Date().toISOString().split("T")[0];

  const existingLog = await TaskLog.findOne({ taskId, dateString: today });

  if (existingLog) {
    await TaskLog.findByIdAndDelete(existingLog._id);
  } else {
    await TaskLog.create({
      taskId,
      dateString: today,
      pointsEarned: points
    });
  }
  revalidatePath("/");
}

export async function addTask(text: string) {
  await connectDB();
  
  const lowerText = text.toLowerCase();
  
  // Parse Points (e.g., "50 pts")
  const pointsMatch = lowerText.match(/(\d+)\s*(?:pt|point|pts)/);
  const points = pointsMatch ? parseInt(pointsMatch[1]) : 1; 

  const domains = await Domain.find({ isActive: true }).lean();
  
  // Parse Domain (Match against existing domain names)
  let targetDomain = domains.find((d: any) => lowerText.includes(d.name.toLowerCase()));
  if (!targetDomain) targetDomain = domains[0]; // Default to first domain if not found

  // Clean Title (Remove points and domain words)
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
  const today = new Date().toISOString().split("T")[0];
  
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