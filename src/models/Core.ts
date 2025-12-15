import mongoose, { Schema, model, models } from "mongoose";

// 1. Domain: The Categories of your life
const DomainSchema = new Schema({
  name: { type: String, required: true },
  color: { type: String, default: "#000000" }, 
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

// 2. Task: The specific habits
const TaskSchema = new Schema({
  domainId: { type: Schema.Types.ObjectId, ref: "Domain", required: true },
  title: { type: String, required: true },
  points: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
});

// 3. TaskLog: The history of what you did and when
const TaskLogSchema = new Schema({
  taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
  // We store date as String "YYYY-MM-DD" for easy querying/grouping
  dateString: { type: String, required: true, index: true }, 
  pointsEarned: { type: Number, required: true },
  completedAt: { type: Date, default: Date.now },
});
const GameSettingsSchema = new Schema({
  userEmail: { type: String, required: true, unique: true }, // "me" for now
  isLocked: { type: Boolean, default: false },
  lockDate: { type: String }, // Which date is currently locked?
  earnedBadges: { type: [String], default: []}
});

export const GameSettings = models.GameSettings || model("GameSettings", GameSettingsSchema);

// "models.X || model('X', ...)" prevents OverwriteModelError in Next.js
export const Domain = models.Domain || model("Domain", DomainSchema);
export const Task = models.Task || model("Task", TaskSchema);
export const TaskLog = models.TaskLog || model("TaskLog", TaskLogSchema);