import { LucideIcon, Flame, Dumbbell, Wallet, Brain, Heart, Zap, Award } from "lucide-react";

export type BadgeDef = {
  id: string;
  name: string;
  description: string;
  icon: any; // Lucide Icon
  color: string;
  // Criteria
  type: "streak" | "total_tasks" | "domain_tasks";
  threshold: number;
  domainName?: string; // Only for domain_tasks
};

export const BADGES: BadgeDef[] = [
  // --- STREAK BADGES ---
  {
    id: "streak_7",
    name: "Beast Star I",
    description: "7 Day Streak. Consistency is the key.",
    icon: Flame,
    color: "#f59e0b", // Amber
    type: "streak",
    threshold: 7
  },
  {
    id: "streak_30",
    name: "Beast Star III",
    description: "30 Day Streak. You are a machine.",
    icon: Zap,
    color: "#ef4444", // Red
    type: "streak",
    threshold: 30
  },
  {
    id: "streak_45",
    name: "Soldier Star I",
    description: "45 Day Streak. Discipline is your nature.",
    icon: Award,
    color: "#a855f7", // Purple
    type: "streak",
    threshold: 45
  },

  // --- DOMAIN BADGES ---
  {
    id: "finance_10",
    name: "Miser Star I",
    description: "Complete 10 Financial Tasks.",
    icon: Wallet,
    color: "#22c55e", // Green
    type: "domain_tasks",
    threshold: 10,
    domainName: "Financial"
  },
  {
    id: "physical_10",
    name: "Iron Body I",
    description: "Complete 10 Physical Tasks.",
    icon: Dumbbell,
    color: "#e11d48", // Rose
    type: "domain_tasks",
    threshold: 10,
    domainName: "Physical"
  },
  {
    id: "spiritual_10",
    name: "Monk Mind I",
    description: "Complete 10 Spiritual Tasks.",
    icon: Brain,
    color: "#8b5cf6", // Violet
    type: "domain_tasks",
    threshold: 10,
    domainName: "Spiritual"
  }
];