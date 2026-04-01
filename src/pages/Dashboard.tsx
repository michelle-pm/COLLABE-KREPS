import React, { useEffect, useState } from "react";
import { db, handleFirestoreError, OperationType, safeSnapshot } from "../firebase";
import { collection, query, where, limit, orderBy, Timestamp, addDoc, serverTimestamp, getDocs, doc, setDoc } from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Project, UserProfile } from "../types";
import { 
  Briefcase, 
  Users, 
  MessageSquare, 
  Clock, 
  ChevronRight,
  Plus,
  Search,
  AlertCircle,
  X,
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { migrateProjectsData } from "../services/migrationService";

export function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({
    activeProjects: 0,
    totalFriends: 0,
    unreadMessages: 0,
    totalFriends1: 0,
    totalFriends2: 0
  });
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [migrating, setMigrating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.uid === "naC25hhpwxcL49gcLSR9QNgsfto1" || 
                  user?.email === "kreps.michaelle@gmail.com" ||
                  user?.email === "michelle-kreps@yandex.ru";

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!user) return;

    // Fetch active projects using 2 safe queries
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
      const sorted = unique.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
      setProjects(sorted);
      setStats(prev => ({ ...prev, activeProjects: unique.length }));
      setError(null);
    };

    const ownerQuery = query(
      collection(db, "projects"),
      where("owner_uid", "==", user.uid),
      where("status", "==", "active"),
      orderBy("updatedAt", "desc"),
      limit(5)
    );

    const participantQuery = query(
      collection(db, "projects"),
      where("participant_uids", "array-contains", user.uid),
      where("status", "==", "active"),
      orderBy("updatedAt", "desc"),
      limit(5)
    );

    unsub1 = safeSnapshot(
      ownerQuery,
      (snapshot: any) => {
        ownerDocs = processDocs(snapshot.docs);
        updateState();
      },
      (err) => {
        console.error("Dashboard owner projects error:", err);
        if (err.code === 'permission-denied') {
          toast.error("Доступ к некоторым проектам ограничен");
        }
      },
      OperationType.GET,
      "projects"
    );

    unsub2 = safeSnapshot(
      participantQuery,
      (snapshot: any) => {
        participantDocs = processDocs(snapshot.docs);
        updateState();
      },
      (err) => {
        console.error("Dashboard participant projects error:", err);
      },
      OperationType.GET,
      "projects"
    );

    // Fetch friends count - separate listeners to avoid nesting
    const friendsQuery = query(
      collection(db, "friends"),
      where("status", "==", "accepted"),
      where("participant1", "==", user.uid)
    );
    const friendsQuery2 = query(
      collection(db, "friends"),
      where("status", "==", "accepted"),
      where("participant2", "==", user.uid)
    );

    const unsubscribeFriends1 = safeSnapshot(
      friendsQuery,
      (s1: any) => {
        setStats(prev => ({ ...prev, totalFriends1: s1.size }));
      },
      (err) => {
        console.error("Dashboard friends 1 error:", err);
      },
      OperationType.GET,
      "friends"
    );

    const unsubscribeFriends2 = safeSnapshot(
      friendsQuery2,
      (s2: any) => {
        setStats(prev => ({ ...prev, totalFriends2: s2.size }));
      },
      (err) => {
        console.error("Dashboard friends 2 error:", err);
      },
      OperationType.GET,
      "friends"
    );

    return () => {
      unsub1();
      unsub2();
      unsubscribeFriends1();
      unsubscribeFriends2();
    };
  }, [user]);

  // Derived stats to avoid state update loops
  const totalFriends = stats.totalFriends1 + stats.totalFriends2 || 0;

  const handleMigrate = async () => {
    if (!isAdmin) return;
    setMigrating(true);
    try {
      await migrateProjectsData();
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Панель управления</h1>
          <p className="text-slate-400 mt-2">Добро пожаловать в ваше рабочее пространство.</p>
          {isAdmin && (
            <button 
              onClick={handleMigrate}
              disabled={migrating}
              className="mt-4 text-xs bg-white/5 hover:bg-white/10 text-slate-400 px-3 py-1 rounded-lg border border-white/10 transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${migrating ? 'animate-spin' : ''}`} />
              {migrating ? "Миграция..." : "Запустить миграцию данных"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Поиск проектов..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all w-64"
            />
          </div>
          <button 
            onClick={() => setShowNewProject(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Новый проект</h2>
              <button onClick={() => setShowNewProject(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={async (e) => {
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
                console.error("Create project error:", error);
                toast.error("Ошибка создания проекта");
              } finally {
                setLoading(false);
              }
            }} className="space-y-6">
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

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-amber-400 text-sm mb-6">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Активные проекты", value: stats.activeProjects, icon: Briefcase, color: "text-blue-400", bg: "bg-blue-400/10" },
          { label: "Друзья", value: totalFriends, icon: Users, color: "text-purple-400", bg: "bg-purple-400/10" },
          { label: "Сообщения", value: stats.unreadMessages, icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-400/10" },
        ].map((stat, i) => (
          <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-3xl font-bold text-white">{stat.value}</span>
            </div>
            <p className="text-slate-400 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-indigo-400" />
              Последние проекты
            </h2>
            <Link to="/projects" className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold transition-colors">
              Все проекты
            </Link>
          </div>

          <div className="space-y-4">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <Link 
                  key={project.id} 
                  to={`/projects/${project.id}`}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                      {project.title[0]}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold group-hover:text-indigo-400 transition-colors">{project.title}</h3>
                      <p className="text-slate-500 text-xs flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        Обновлено {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                </Link>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500">
                  {searchQuery ? "Проекты не найдены" : "У вас пока нет активных проектов."}
                </p>
                {!searchQuery && (
                  <button 
                    onClick={() => setShowNewProject(true)}
                    className="text-indigo-400 font-semibold mt-2 hover:underline"
                  >
                    Создать первый проект
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed Placeholder */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Clock className="w-5 h-5 text-purple-400" />
              Активность
            </h2>
          </div>

          <div className="space-y-6">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex gap-4 relative">
                {i < 2 && <div className="absolute left-5 top-10 bottom-0 w-px bg-white/10" />}
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                </div>
                <div>
                  <p className="text-slate-300 text-sm">
                    <span className="text-white font-semibold">Система:</span> Добро пожаловать в Коллаб! Начните с добавления друзей.
                  </p>
                  <span className="text-slate-500 text-xs mt-1 block">Только что</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
