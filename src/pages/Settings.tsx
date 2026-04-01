import React, { useState } from "react";
import { useAuth } from "../components/FirebaseProvider";
import { db, auth } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Moon, 
  Globe, 
  LogOut, 
  Camera,
  Save,
  ChevronRight,
  UserCircle
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function Settings() {
  const { profile, user } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        updatedAt: new Date().toISOString()
      });
      toast.success("Профиль обновлен!");
    } catch (error) {
      toast.error("Ошибка обновления профиля");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white tracking-tight flex items-center gap-4">
          <Settings className="w-10 h-10 text-indigo-500" />
          Настройки
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Nav */}
        <aside className="space-y-2">
          {[
            { label: "Профиль", icon: User, active: true },
            { label: "Безопасность", icon: Shield },
            { label: "Уведомления", icon: Bell },
            { label: "Внешний вид", icon: Moon },
            { label: "Язык", icon: Globe },
          ].map((item, i) => (
            <button 
              key={i}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                item.active 
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="font-semibold">{item.label}</span>
              </div>
              <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-all ${item.active ? 'opacity-100' : ''}`} />
            </button>
          ))}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all mt-8"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-semibold">Выйти из аккаунта</span>
          </button>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Section */}
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
              <UserCircle className="w-5 h-5 text-indigo-400" />
              Личные данные
            </h2>

            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-2xl group-hover:scale-105 transition-transform">
                  {profile?.name?.[0] || "?"}
                </div>
                <button className="absolute -bottom-2 -right-2 p-2 bg-slate-900 border border-white/10 rounded-xl text-indigo-400 hover:text-white hover:bg-indigo-500 transition-all shadow-xl">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-500 text-xs mt-4 uppercase tracking-widest font-bold">Фото профиля</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider ml-1">Имя пользователя</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Ваше имя"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider ml-1">Email адрес</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input 
                    type="email" 
                    value={profile?.email || ""}
                    disabled
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-600 ml-1 italic">Email нельзя изменить после регистрации.</p>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {loading ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </form>
          </section>

          {/* Account Status */}
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">Статус аккаунта</h2>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 font-semibold">Активен</span>
              </div>
              <span className="text-slate-500 text-xs">Создан: {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('ru-RU') : "Неизвестно"}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
