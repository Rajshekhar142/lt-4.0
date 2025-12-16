"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react"; // Removed ChevronUp (we rotate instead)
import TaskItem from "./TaskItem";

interface DomainSectionProps {
  domain: any;
  tasks: any[];
  isLocked: boolean;
}

export default function DomainSection({ domain, tasks, isLocked }: DomainSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const doneCount = tasks.filter(t => t.isCompleted).length;
  const totalCount = tasks.length;
  const domainPoints = tasks.reduce((acc, t) => acc + t.points, 0);
  const earnedPoints = tasks.filter(t => t.isCompleted).reduce((acc, t) => acc + t.points, 0);

  return (
    <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl overflow-hidden transition-all duration-300">
      
      {/* Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-neutral-900/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 rounded-full transition-all group-hover:h-10" style={{ backgroundColor: domain.color }} />
          
          <div className="text-left">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {domain.name}
            </h2>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              {doneCount}/{totalCount} Done • {earnedPoints}/{domainPoints} pts
            </p>
          </div>
        </div>

        {/* Arrow rotates instead of swapping icons */}
        <div className={`text-neutral-500 transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}>
          <ChevronDown size={20} />
        </div>
      </button>

      {/* The Smooth Grid Animation Trick */}
      <div 
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="p-3 pt-0">
            <div className="h-px bg-neutral-800 w-full mb-3" />
            
            {tasks.map((task) => (
              <TaskItem 
                key={task._id}
                id={task._id}
                title={task.title}
                points={task.points}
                color={domain.color}
                isCompleted={task.isCompleted}
                isLocked={isLocked}
              />
            ))}
            
            {tasks.length === 0 && (
              <p className="text-xs text-neutral-600 text-center py-2 italic">No tasks yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}