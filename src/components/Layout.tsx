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
  Shield
} from "lucide-react";
import { auth } from "../firebase";
import { useAuth } from "./FirebaseProvider";
import { cn } from "../lib/utils";

const navItems = [
  { path: "/", label: "Главная", icon: LayoutDashboard },
  { path: "/friends", label: "Друзья", icon: Users },
  { path: "/messages", label: "Сообщения", icon: MessageSquare },
  { path: "/projects", label: "Проекты", icon: Briefcase },
  { path: "/settings", label: "Настройки", icon: Settings },
];

export function Layout() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

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
        <aside className="w-64 border-r border-white/5 bg-white/5 backdrop-blur-xl flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Коллаб</span>
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
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                  location.pathname === item.path ? "text-indigo-400" : "text-slate-500"
                )} />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
            {profile?.role === 'admin' && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  location.pathname === "/admin"
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <Shield className={cn(
                  "w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                  location.pathname === "/admin" ? "text-indigo-400" : "text-slate-500"
                )} />
                <span className="font-medium">Админ</span>
              </Link>
            )}
          </nav>

          <div className="p-4 mt-auto border-t border-white/5">
            <div className="flex items-center gap-3 px-4 py-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                {profile?.name?.[0] || profile?.email?.[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate">{profile?.name || "Пользователь"}</span>
                <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Участник</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Выйти</span>
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
