import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  ChevronRight, 
  Briefcase,
  Calendar,
  Tag,
  User
} from "lucide-react";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  getDoc,
  Timestamp,
  collectionGroup
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Project, TaskItem, ProjectParticipant } from "../types";
import { cn } from "../lib/utils";
import { toast } from "sonner";

export function GlobalTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<(TaskItem & { projectTitle: string })[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');

  useEffect(() => {
    if (!user) return;

    const fetchProjectsAndTasks = async () => {
      setLoading(true);
      try {
        // 1. Fetch projects where user is a participant
        const projectsQuery = query(
          collection(db, "projects"),
          where("participant_uids", "array-contains", user.uid)
        );
        const projectsSnap = await getDocs(projectsQuery);
        const projectsData = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        setProjects(projectsData);

        // 2. Fetch tasks for each project where user is assignee
        // Note: In a real app with many projects, we'd use collectionGroup query.
        // For this app, we'll fetch per project for simplicity and to avoid index issues.
        const allTasks: (TaskItem & { projectTitle: string })[] = [];
        
        for (const project of projectsData) {
          const tasksRef = collection(db, `projects/${project.id}/tasks`);
          const q = query(
            tasksRef,
            where("assigneeUids", "array-contains", user.uid),
            where("archived", "==", false)
          );
          const tasksSnap = await getDocs(q);
          tasksSnap.docs.forEach(d => {
            allTasks.push({ 
              id: d.id, 
              ...d.data(), 
              projectTitle: project.title 
            } as TaskItem & { projectTitle: string });
          });
        }
        
        setMyTasks(allTasks.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.toMillis() - b.dueDate.toMillis();
        }));
      } catch (error) {
        console.error("Error fetching global tasks:", error);
        toast.error("Ошибка при загрузке задач");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectsAndTasks();
  }, [user]);

  const filteredTasks = myTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         task.projectTitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (filter === 'overdue') {
      return task.dueDate && task.dueDate.toDate() < now && task.status !== 'done';
    }
    if (filter === 'today') {
      return task.dueDate && task.dueDate.toDate() >= now && task.dueDate.toDate() < tomorrow;
    }
    if (filter === 'upcoming') {
      return task.dueDate && task.dueDate.toDate() >= tomorrow;
    }
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-indigo-400 mb-2">
            <CheckSquare className="w-6 h-6" />
            <span className="text-xs font-black uppercase tracking-[0.3em] italic">Задачи</span>
          </div>
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
            Мои задачи
          </h1>
          <p className="text-xl text-slate-400 font-serif italic">
            Все назначенные вам задачи из всех активных проектов
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Поиск по задачам или проектам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-80 transition-all"
            />
          </div>
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl">
            {(['all', 'overdue', 'today', 'upcoming'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filter === f ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {f === 'all' ? 'Все' : f === 'overdue' ? 'Просрочено' : f === 'today' ? 'Сегодня' : 'Предстоящие'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white/5 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map((task) => (
            <div 
              key={task.id}
              onClick={() => navigate(`/projects/${task.projectId}/tasks`)}
              className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex items-center justify-between group hover:border-indigo-500/30 hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-6 flex-1">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110",
                  task.status === 'done' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                )}>
                  <CheckSquare className="w-6 h-6" />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{task.title}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                      getPriorityColor(task.priority)
                    )}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3 h-3" />
                      <span className="font-bold text-indigo-400/70">{task.projectTitle}</span>
                    </div>
                    {task.dueDate && (
                      <div className={cn(
                        "flex items-center gap-1.5",
                        task.dueDate.toDate() < new Date() && task.status !== 'done' ? "text-red-400" : ""
                      )}>
                        <Clock className="w-3 h-3" />
                        <span>До {task.dueDate.toDate().toLocaleDateString('ru-RU')}</span>
                      </div>
                    )}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3" />
                        <span>{task.tags.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Статус</div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    task.status === 'done' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-slate-400"
                  )}>
                    {task.status.replace('_', ' ')}
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/5 border border-dashed border-white/10 rounded-[3rem] p-20 text-center space-y-6">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto">
            <CheckSquare className="w-10 h-10 text-indigo-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">Задач не найдено</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              {searchQuery ? "По вашему запросу ничего не найдено. Попробуйте изменить параметры поиска." : "У вас пока нет назначенных задач. Они появятся здесь, когда вас назначат ответственным в одном из проектов."}
            </p>
          </div>
        </div>
      )}

      {/* Projects Overview */}
      {!loading && projects.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-indigo-500" />
            <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Ваши проекты</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div 
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}/tasks`)}
                className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:border-indigo-500/30 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{project.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-4 italic font-serif">
                  {project.description || "Нет описания"}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex -space-x-2">
                    {project.participant_uids.slice(0, 3).map((uid, i) => (
                      <div key={uid} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                        {uid[0].toUpperCase()}
                      </div>
                    ))}
                    {project.participant_uids.length > 3 && (
                      <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        +{project.participant_uids.length - 3}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                    Открыть доску
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
