import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskItem } from "../../types";
import { cn } from "../../lib/utils";
import { 
  Clock, 
  AlertCircle, 
  CheckSquare, 
  MessageSquare, 
  Paperclip,
  Tag,
  Calendar,
  MoreVertical
} from "lucide-react";

interface KanbanCardProps {
  key?: string;
  task: TaskItem;
  isOverlay?: boolean;
  onClick?: () => void;
}

export function KanbanCard({ task, isOverlay, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const priorityColors = {
    low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    critical: "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)]",
  };

  const statusColors = {
    backlog: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    todo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    review: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blocked: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const isOverdue = task.dueDate && task.dueDate.toMillis() < Date.now() && task.status !== 'done';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 transition-all duration-200 cursor-grab active:cursor-grabbing hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10",
        isDragging && "opacity-0",
        isOverlay && "opacity-100 scale-[1.05] shadow-2xl shadow-indigo-500/20 border-indigo-500/50 rotate-2"
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <span className={cn(
            "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
            priorityColors[task.priority]
          )}>
            {task.priority}
          </span>
          {task.sourceType !== 'general' && (
            <span className="px-2 py-0.5 bg-white/5 text-slate-400 text-[9px] font-black uppercase tracking-widest border border-white/5 rounded-lg">
              {task.sourceType}
            </span>
          )}
        </div>
        <button className="p-1 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>

      <h4 className="text-sm font-bold text-white mb-3 leading-tight tracking-tight group-hover:text-indigo-400 transition-colors">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
          {task.description}
        </p>
      )}

      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {task.tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-indigo-500/10">
              <Tag className="w-2 h-2" />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          {task.dueDate && (
            <div className={cn(
              "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest",
              isOverdue ? "text-red-400" : "text-slate-500"
            )}>
              <Calendar className="w-3 h-3" />
              {new Date(task.dueDate.toMillis()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </div>
          )}
          {task.checklist && task.checklist.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <CheckSquare className="w-3 h-3" />
              {task.checklist.filter(i => i.done).length}/{task.checklist.length}
            </div>
          )}
        </div>

        <div className="flex -space-x-2">
          {task.assigneeUids.slice(0, 3).map((uid, i) => (
            <div 
              key={uid}
              className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border-2 border-slate-900 flex items-center justify-center text-[8px] font-black text-white shadow-lg"
              title={uid}
            >
              {uid[0].toUpperCase()}
            </div>
          ))}
          {task.assigneeUids.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[8px] font-black text-slate-400 shadow-lg">
              +{task.assigneeUids.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
