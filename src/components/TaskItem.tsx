"use client";

import { Circle, CheckCircle2 } from "lucide-react";
import { useTransition } from "react";
import { toggleTask } from "@/app/actions"; // Import the server action

interface TaskItemProps {
  id: string; // We need ID now to know what to toggle
  title: string;
  points: number;
  color: string;
  isCompleted: boolean;
}

export default function TaskItem({ id, title, points, color, isCompleted }: TaskItemProps) {
  let [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    // This wrapper keeps the app responsive while the server works
    startTransition(async () => {
      await toggleTask(id, points);
    });
  };

  return (
    <div 
      onClick={handleToggle}
      className={`
        group flex items-center gap-4 p-4 mb-3 border rounded-2xl cursor-pointer select-none transition-all active:scale-95
        ${isCompleted 
          ? "bg-neutral-900/30 border-neutral-900 opacity-50" 
          : "bg-neutral-900/50 border-neutral-800 hover:bg-neutral-900"
        }
      `}
    >
      {/* Icon: Swaps between Circle and Check */}
      <div style={{ color: isCompleted ? "#4ade80" : color }} className="transition-colors">
        {isCompleted ? <CheckCircle2 size={24} /> : <Circle size={24} />}
      </div>
      
      {/* Text Info */}
      <div className="flex-1">
        <h3 className={`font-medium text-sm transition-all ${isCompleted ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
          {title}
        </h3>
        <p className="text-xs text-neutral-500 font-medium">Daily • {points} pts</p>
      </div>
    </div>
  );
}