import React, { useEffect, useState } from "react";
import { db, handleFirestoreError, OperationType, safeSnapshot } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  getDocs,
  orderBy,
  Timestamp,
  doc,
  setDoc
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Project } from "../types";
import { useNavigate } from "react-router-dom";
import { 
  Briefcase, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  Users, 
  MoreVertical,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    if (!user) return;

    // Fetch projects using 2 safe queries
    let unsub1: () => void = () => {};
    let unsub2: () => void = () => {};

    const processDocs = (docs: any[]) => {
      return docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
        } as Project;
      });
    };

    let ownerDocs: Project[] = [];
    let participantDocs: Project[] = [];

    const updateState = () => {
      const combined = [...ownerDocs, ...participantDocs];
      const unique = Array.from(new Map(combined.map(p => [p.id, p])).values());
      const sorted = unique.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setProjects(sorted);
      setError(null);
    };

    const ownerQuery = query(
      collection(db, "projects"),
      where("owner_uid", "==", user.uid),
      orderBy("updatedAt", "desc")
    );

    const participantQuery = query(
      collection(db, "projects"),
      where("participant_uids", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );

    unsub1 = safeSnapshot(
      ownerQuery,
      (snapshot: any) => {
        ownerDocs = processDocs(snapshot.docs);
        updateState();
      },
      (err) => {
        console.error("Projects owner query error:", err);
        if (err.code === 'permission-denied') {
          toast.error("Доступ к некоторым проектам ограничен");
        }
      },
      OperationType.LIST,
      "projects"
    );

    unsub2 = safeSnapshot(
      participantQuery,
      (snapshot: any) => {
        participantDocs = processDocs(snapshot.docs);
        updateState();
      },
      (err) => {
        console.error("Projects participant query error:", err);
      },
      OperationType.LIST,
      "projects"
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title.trim() || !user) return;
    setLoading(true);

    try {
      const projectRef = await addDoc(collection(db, "projects"), {
        title: newProject.title.trim(),
        description: newProject.description.trim(),
        owner_uid: user.uid,
        participant_uids: [user.uid],
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Also add owner to participants subcollection
      await setDoc(doc(db, "projects", projectRef.id, "participants", user.uid), {
        uid: user.uid,
        role: 'owner',
        active: true,
        joinedAt: serverTimestamp()
      });

      toast.success("Проект создан!");
      setShowNewProject(false);
      setNewProject({ title: "", description: "" });
    } catch (error) {
      toast.error("Ошибка создания проекта");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white tracking-tight flex items-center gap-4">
          <Briefcase className="w-10 h-10 text-indigo-500" />
          Проекты
        </h1>
        <button 
          onClick={() => setShowNewProject(true)}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Новый проект
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Поиск по проектам..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white/5 border border-white/10 text-slate-400 px-4 py-4 rounded-2xl flex items-center gap-2 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="completed">Завершенные</option>
            <option value="archived">Архивные</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-amber-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <div 
              key={project.id} 
              onClick={() => {
                console.log("Navigating to project:", project.id);
                navigate(`/projects/${project.id}`);
              }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info("Меню проекта в разработке");
                  }}
                  className="text-slate-600 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl">
                  {project.title[0]}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">{project.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {project.status === 'active' ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                        Активен
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {project.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-sm line-clamp-2 mb-6 min-h-[40px]">
                {project.description || "Нет описания проекта."}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <div className="flex -space-x-2">
                  {project.participant_uids.slice(0, 3).map((uid, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-indigo-500/20">
                      {uid.slice(0, 1).toUpperCase()}
                    </div>
                  ))}
                  {project.participant_uids.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      +{project.participant_uids.length - 3}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-slate-500 text-xs">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projects/${project.id}`);
                }}
                className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-indigo-500 hover:border-indigo-500 transition-all font-bold"
              >
                Открыть проект
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-20 bg-white/5 border border-white/10 rounded-3xl">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-10 h-10 text-slate-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Проектов пока нет</h2>
            <p className="text-slate-500 mb-8">Начните совместную работу, создав свой первый проект.</p>
            <button 
              onClick={() => setShowNewProject(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold transition-all active:scale-95"
            >
              Создать проект
            </button>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Новый проект</h2>
              <button onClick={() => setShowNewProject(false)} className="text-slate-500 hover:text-white transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-6">
              <div>
                <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-wider">Название проекта</label>
                <input 
                  type="text" 
                  value={newProject.title}
                  onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="Введите название..."
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-wider">Описание</label>
                <textarea 
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all h-32 resize-none"
                  placeholder="О чем этот проект?"
                />
              </div>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? "Создание..." : "Создать проект"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
