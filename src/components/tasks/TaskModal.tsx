import React, { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  CheckSquare, 
  MessageSquare, 
  History, 
  Calendar, 
  User, 
  Tag, 
  AlertCircle,
  Link as LinkIcon,
  Send
} from "lucide-react";
import { 
  TaskItem, 
  TaskChecklistItem, 
  TaskComment, 
  TaskActivity,
  ProjectParticipant
} from "../../types";
import { taskService } from "../../services/taskService";
import { cn } from "../../lib/utils";
import { Timestamp, collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "sonner";

interface TaskModalProps {
  projectId: string;
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  participants: ProjectParticipant[];
  currentUserUid: string;
  actorRole: string;
  initialColumnId?: string;
  initialStatus?: string;
}

export function TaskModal({ 
  projectId, 
  task, 
  isOpen, 
  onClose, 
  participants, 
  currentUserUid,
  actorRole,
  initialColumnId,
  initialStatus
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskItem['priority']>("medium");
  const [sourceType, setSourceType] = useState<TaskItem['sourceType']>("general");
  const [linkedBookingCode, setLinkedBookingCode] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeUids, setAssigneeUids] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity'>('details');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setSourceType(task.sourceType);
      setLinkedBookingCode(task.linkedBookingCode || "");
      setDueDate(task.dueDate ? new Date(task.dueDate.toMillis()).toISOString().split('T')[0] : "");
      setAssigneeUids(task.assigneeUids);
      setTags(task.tags || []);
      setChecklist(task.checklist || []);
      
      // Subscribe to comments
      const commentsRef = collection(db, `projects/${projectId}/task_comments`);
      const unsubComments = onSnapshot(
        query(commentsRef, where("taskId", "==", task.id), orderBy("createdAt", "desc")),
        (snapshot) => {
          setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskComment)));
        }
      );

      // Subscribe to activity
      const activityRef = collection(db, `projects/${projectId}/task_activity`);
      const unsubActivity = onSnapshot(
        query(activityRef, where("taskId", "==", task.id), orderBy("createdAt", "desc")),
        (snapshot) => {
          setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskActivity)));
        }
      );

      return () => {
        unsubComments();
        unsubActivity();
      };
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setSourceType("general");
      setLinkedBookingCode("");
      setDueDate("");
      setAssigneeUids([]);
      setTags([]);
      setChecklist([]);
      setComments([]);
      setActivities([]);
    }
  }, [task, projectId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Введите название задачи");
      return;
    }

    setIsSaving(true);
    try {
      const taskData: Partial<TaskItem> = {
        title,
        description,
        priority,
        sourceType,
        linkedBookingCode,
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        assigneeUids,
        tags,
        checklist,
        updatedAt: Timestamp.now()
      };

      if (task) {
        await taskService.updateTask(projectId, task.id, taskData, currentUserUid, actorRole);
        await taskService.logTaskActivity(projectId, task.id, currentUserUid, 'updated', { changes: taskData });
        toast.success("Задача обновлена");
      } else {
        const newTask = {
          ...taskData,
          columnId: initialColumnId || "",
          status: (initialStatus || "todo") as any,
          order: 0,
          createdBy: currentUserUid,
          archived: false
        };
        const docRef = await taskService.createTask(projectId, newTask, currentUserUid, actorRole);
        await taskService.logTaskActivity(projectId, docRef.id, currentUserUid, 'created', {});
        toast.success("Задача создана");
      }
      onClose();
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error("Ошибка при сохранении задачи");
    } finally {
      setIsSaving(false);
    }
  };

  const [showConfirmArchive, setShowConfirmArchive] = useState(false);

  const handleArchive = async () => {
    if (!task || !projectId) return;
    
    setIsSaving(true);
    try {
      await taskService.archiveTask(projectId, task.id, currentUserUid, actorRole);
      await taskService.logTaskActivity(projectId, task.id, currentUserUid, 'archived', {});
      toast.success("Задача архивирована");
      onClose();
    } catch (error) {
      console.error("Error archiving task:", error);
      toast.error("Ошибка при архивации задачи");
    } finally {
      setIsSaving(false);
      setShowConfirmArchive(false);
    }
  };

  const handleAddComment = async () => {
    if (!task || !newComment.trim()) return;
    try {
      await taskService.addTaskComment(projectId, task.id, currentUserUid, newComment);
      setNewComment("");
    } catch (error) {
      toast.error("Ошибка при добавлении комментария");
    }
  };

  const toggleChecklistItem = (index: number) => {
    const newChecklist = [...checklist];
    newChecklist[index].done = !newChecklist[index].done;
    setChecklist(newChecklist);
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, { id: Math.random().toString(36).substr(2, 9), text: newChecklistItem, done: false }]);
    setNewChecklistItem("");
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    setTags([...tags, newTag.trim()]);
    setNewTag("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const toggleAssignee = (uid: string) => {
    if (assigneeUids.includes(uid)) {
      setAssigneeUids(assigneeUids.filter(id => id !== uid));
    } else {
      setAssigneeUids([...assigneeUids, uid]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-indigo-500/10">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
              <CheckSquare className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight italic">
                {task ? "Редактировать задачу" : "Новая задача"}
              </h2>
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest">
                {task ? `ID: ${task.id}` : "Заполнение данных"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row">
          {/* Left Column: Main Info */}
          <div className="flex-1 p-8 space-y-8 border-r border-white/5">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Название задачи</label>
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Что нужно сделать?"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Описание</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Добавьте подробности..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Приоритет</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm appearance-none font-bold"
                  >
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                    <option value="critical">Критический</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Срок выполнения</label>
                  <input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm font-bold"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Чек-лист</label>
                <div className="space-y-3">
                  {checklist.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 group">
                      <button 
                        onClick={() => toggleChecklistItem(index)}
                        className={cn(
                          "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                          item.done ? "bg-indigo-500 border-indigo-500" : "border-white/10 hover:border-indigo-500/50"
                        )}
                      >
                        {item.done && <Plus className="w-3 h-3 text-white rotate-45" />}
                      </button>
                      <span className={cn(
                        "flex-1 text-sm transition-all",
                        item.done ? "text-slate-500 line-through" : "text-white"
                      )}>
                        {item.text}
                      </span>
                      <button 
                        onClick={() => removeChecklistItem(index)}
                        className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5" />
                    <input 
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                      placeholder="Добавить пункт..."
                      className="flex-1 bg-transparent border-b border-white/5 text-sm text-white focus:outline-none focus:border-indigo-500/50 py-1 transition-all"
                    />
                    <button onClick={addChecklistItem} className="p-1 text-indigo-400 hover:text-indigo-300">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Meta & Sidebar */}
          <div className="w-full lg:w-80 p-8 bg-white/5 space-y-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Исполнители</label>
                <div className="flex flex-wrap gap-2">
                  {participants.map(p => (
                    <button 
                      key={p.uid}
                      onClick={() => toggleAssignee(p.uid)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                        assigneeUids.includes(p.uid) 
                          ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20" 
                          : "bg-white/5 text-slate-400 border-white/5 hover:border-white/10"
                      )}
                    >
                      {p.uid.substring(0, 8)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Теги</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-indigo-500/10">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-400">
                        <X className="w-2 h-2" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Новый тег..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                  <button onClick={addTag} className="p-2 bg-indigo-500 rounded-xl text-white">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Источник</label>
                <select 
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none font-bold"
                >
                  <option value="general">Общая</option>
                  <option value="booking">Бронирование</option>
                  <option value="project">Проект</option>
                </select>
                {sourceType === 'booking' && (
                  <input 
                    type="text"
                    value={linkedBookingCode}
                    onChange={(e) => setLinkedBookingCode(e.target.value)}
                    placeholder="Код бронирования..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 mt-2 font-bold"
                  />
                )}
              </div>
            </div>

            {task && (
              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex p-1 bg-white/5 rounded-xl">
                  <button 
                    onClick={() => setActiveTab('comments')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === 'comments' ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"
                    )}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Чаты
                  </button>
                  <button 
                    onClick={() => setActiveTab('activity')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === 'activity' ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"
                    )}
                  >
                    <History className="w-3 h-3" />
                    Лог
                  </button>
                </div>

                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                      {comments.map(comment => (
                        <div key={comment.id} className="bg-white/5 rounded-2xl p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-indigo-400 uppercase">{comment.authorUid.substring(0, 8)}</span>
                            <span className="text-[8px] text-slate-500">{comment.createdAt?.toDate().toLocaleTimeString()}</span>
                          </div>
                          <p className="text-xs text-white leading-relaxed">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                    <div className="relative">
                      <input 
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                        placeholder="Написать..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-4 pr-10 text-xs text-white focus:outline-none"
                      />
                      <button onClick={handleAddComment} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {activities.map(activity => (
                      <div key={activity.id} className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-white">
                            <span className="font-black text-indigo-400">{activity.actorUid.substring(0, 8)}</span>
                            {" "}{activity.actionType}
                          </p>
                          <p className="text-[8px] text-slate-500">{activity.createdAt?.toDate().toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex items-center justify-between bg-white/5">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {task ? "Последнее изменение: " + (task.updatedAt?.toDate().toLocaleString() || "неизвестно") : "Черновик"}
          </div>
          <div className="flex items-center gap-4">
            {task && (
              <div className="flex items-center gap-2">
                {showConfirmArchive ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mr-2">Вы уверены?</span>
                    <button 
                      onClick={handleArchive}
                      disabled={isSaving}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50"
                    >
                      Да, архивировать
                    </button>
                    <button 
                      onClick={() => setShowConfirmArchive(false)}
                      className="text-slate-500 hover:text-white px-3 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowConfirmArchive(true)}
                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Архивировать
                  </button>
                )}
              </div>
            )}
            <button 
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-xs font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all"
            >
              Отмена
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              {isSaving ? "Сохранение..." : (task ? "Сохранить изменения" : "Создать задачу")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
