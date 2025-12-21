import mongoose, { Schema, model, models } from "mongoose";

// 1. Domain
const DomainSchema = new Schema({
  name: { type: String, required: true },
  color: { type: String, required: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

// 2. Task
const TaskSchema = new Schema({
  domainId: { type: Schema.Types.ObjectId, ref: "Domain", required: true },
  title: { type: String, required: true },
  points: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
});

// 3. Task Log (Daily Records)
const TaskLogSchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
  dateString: { type: String, required: true }, // "2025-10-25"
  pointsEarned: { type: Number, required: true },
});

// 4. Game Settings (Now with Wallet!)
const GameSettingsSchema = new Schema({
  userEmail: { type: String, required: true, unique: true },
  isLocked: { type: Boolean, default: false },
  lockDate: { type: String },
  earnedBadges: { type: [String], default: [] },
  // NEW: Your Bank Account
  walletBalance: { type: Number, default: 0 } 
});

// 5. Daily History
const DailyHistorySchema = new Schema({
  userEmail: { type: String, required: true, index: true },
  dateString: { type: String, required: true, unique: true },
  totalPoints: { type: Number, required: true },
  tasksCompleted: { type: Number, required: true },
});

export const Domain = models.Domain || model("Domain", DomainSchema);
export const Task = models.Task || model("Task", TaskSchema);
export const TaskLog = models.TaskLog || model("TaskLog", TaskLogSchema);
export const GameSettings = models.GameSettings || model("GameSettings", GameSettingsSchema);
export const DailyHistory = models.DailyHistory || model("DailyHistory", DailyHistorySchema);