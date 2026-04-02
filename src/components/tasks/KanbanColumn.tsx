import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { TaskColumn, TaskItem } from "../../types";
import { KanbanCard } from "./KanbanCard";
import { cn } from "../../lib/utils";
import { MoreVertical, Plus } from "lucide-react";

interface KanbanColumnProps {
  key?: string;
  column: TaskColumn;
  tasks: TaskItem[];
  onTaskClick: (task: TaskItem) => void;
}

export function KanbanColumn({ column, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-80 shrink-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 transition-all duration-200",
        isOver && "bg-white/10 border-indigo-500/30 scale-[1.02]"
      )}
    >
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest">{column.title}</h3>
          <span className="text-[10px] font-black text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {tasks.length}
          </span>
        </div>
        <button className="p-1.5 text-slate-500 hover:text-white transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar min-h-[100px] px-1">
        <SortableContext 
          items={tasks.map(t => t.id)} 
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <KanbanCard 
              key={task.id} 
              task={task} 
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
      </div>

      <button className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl text-xs font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all group">
        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
        Добавить задачу
      </button>
    </div>
  );
}
