"use client";

import { Circle, CheckCircle2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toggleTask, deleteTask } from "@/app/actions";

interface TaskItemProps {
  id: string;
  title: string;
  points: number;
  color: string;
  isCompleted: boolean;
  isLocked: boolean;
}

export default function TaskItem({ id, title, points, color, isCompleted, isLocked }: TaskItemProps) {
  let [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    // FIX: Removed "if (isLocked) return;" 
    // Now you can ALWAYS complete a task, even if the list is locked.
    startTransition(async () => {
      await toggleTask(id, points);
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Delete is strictly forbidden when locked
    if (isLocked) return; 
    
    if (confirm("Delete this task?")) {
      startTransition(async () => {
        await deleteTask(id);
      });
    }
  };

  return (
    <div 
      className={`
        group flex items-center gap-4 p-4 mb-3 border rounded-2xl transition-all
        ${isCompleted 
          ? "bg-neutral-900/30 border-neutral-900 opacity-50" 
          : "bg-neutral-900/50 border-neutral-800"
        }
      `}
    >
      {/* Click Area for Toggling */}
      <div className="flex-1 flex items-center gap-4 cursor-pointer" onClick={handleToggle}>
        <div style={{ color: isCompleted ? "#4ade80" : color }} className="transition-colors">
          {isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
        </div>
        
        <div>
          <h3 className={`font-medium text-sm transition-all ${isCompleted ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
            {title}
          </h3>
          <p className="text-xs text-neutral-500 font-medium">Daily • {points} pts</p>
        </div>
      </div>

      {/* DELETE BUTTON (Hidden if Locked) */}
      {!isLocked && (
        <button 
          onClick={handleDelete}
          className="p-2 text-neutral-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
}