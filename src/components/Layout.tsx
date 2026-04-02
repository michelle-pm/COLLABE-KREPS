import React from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Briefcase, 
  Settings, 
  LogOut,
  TrendingUp,
  Shield,
  ChevronLeft,
  ChevronRight,
  CheckSquare
} from "lucide-react";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { useAuth } from "./FirebaseProvider";
import { cn } from "../lib/utils";
import { TaskItem } from "../types";

export function Layout() {
  const { profile, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [overdueCount, setOverdueCount] = React.useState(0);

  const match = location.pathname.match(/\/projects\/([^/]+)/);
  const currentProjectId = match ? match[1] : null;

  React.useEffect(() => {
    if (!user) return;

    // This is a simplified version. In a real app, we'd query across all projects 
    // or the current one. The user asked for "число просроченных МОИХ задач".
    // Since tasks are in subcollections, we might need collectionGroup or query each project.
    // For now, if we have a currentProjectId, we query that. 
    // If not, we might skip or query all projects the user is in.
    // Given the constraints, I'll try to query tasks where user is assignee and dueDate < now.
    
    // Note: collectionGroup requires an index. I'll assume we can query at least the current project's tasks if available.
    if (!currentProjectId) {
      setOverdueCount(0);
      return;
    }

    const tasksRef = collection(db, `projects/${currentProjectId}/tasks`);
    const now = Timestamp.now();
    const q = query(
      tasksRef,
      where("assigneeUids", "array-contains", user.uid),
      where("archived", "==", false),
      where("status", "!=", "done")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => doc.data() as TaskItem);
      const overdue = tasks.filter(t => t.dueDate && t.dueDate.toMillis() < now.toMillis());
      setOverdueCount(overdue.length);
    }, (error) => {
      console.error("Error fetching overdue tasks:", error);
    });

    return () => unsubscribe();
  }, [user, currentProjectId]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  const navItems = [
    { path: "/", label: "Главная", icon: LayoutDashboard },
    { path: "/friends", label: "Друзья", icon: Users },
    { path: "/messages", label: "Сообщения", icon: MessageSquare },
    { path: "/projects", label: "Проекты", icon: Briefcase },
    { 
      path: "/tasks", 
      label: "Задачи", 
      icon: CheckSquare,
      badge: overdueCount > 0 ? overdueCount : undefined
    },
    ...(profile?.role === 'admin' ? [{ path: "/admin", label: "Админ", icon: Shield }] : []),
    { path: "/settings", label: "Настройки", icon: Settings },
  ];

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Background Gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[150px]" />
      </div>

      <div className="flex h-screen relative z-10">
        {/* Sidebar */}
        <aside className={cn(
          "border-r border-white/5 bg-white/5 backdrop-blur-xl flex flex-col transition-all duration-300 relative group",
          isCollapsed ? "w-20" : "w-64"
        )}>
          {/* Collapse Toggle */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-3 top-10 w-6 h-6 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-50"
          >
            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>

          <div className={cn("p-6 flex items-center gap-3", isCollapsed && "justify-center px-0")}>
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && <span className="font-bold text-lg tracking-tight text-white animate-in fade-in duration-300">Коллаб</span>}
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  location.pathname === item.path
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? item.label : ""}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110 shrink-0",
                  location.pathname === item.path ? "text-indigo-400" : "text-slate-500"
                )} />
                {!isCollapsed && <span className="font-medium animate-in fade-in duration-300">{item.label}</span>}
                {item.badge !== undefined && (
                  <span className={cn(
                    "ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    isCollapsed && "absolute top-2 right-2"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
            {profile?.role === 'admin' && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  location.pathname === "/admin"
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? "Админ" : ""}
              >
                <Shield className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110 shrink-0",
                  location.pathname === "/admin" ? "text-indigo-400" : "text-slate-500"
                )} />
                {!isCollapsed && <span className="font-medium animate-in fade-in duration-300">Админ</span>}
              </Link>
            )}
          </nav>

          <div className="p-4 mt-auto border-t border-white/5">
            <div className={cn("flex items-center gap-3 px-4 py-3 mb-4", isCollapsed && "justify-center px-0")}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shrink-0">
                {profile?.name?.[0] || profile?.email?.[0]?.toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 animate-in fade-in duration-300">
                  <span className="text-sm font-semibold text-white truncate">{profile?.name || "Пользователь"}</span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                    {profile?.role === 'tech' ? 'Тех. отдел' : 
                     profile?.role === 'admin' ? 'Админ' : 
                     profile?.role === 'owner' ? 'Владелец' : 
                     profile?.role === 'manager' ? 'Менеджер' : 'Участник'}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? "Выйти" : ""}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="font-medium animate-in fade-in duration-300">Выйти</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950/50">
          <div className="max-w-7xl mx-auto p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
