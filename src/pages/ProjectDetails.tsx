import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  getDoc,
  Timestamp
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Project, ProjectComment, UserProfile, Booking, Plan } from "../types";
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  UserPlus,
  Settings as SettingsIcon,
  TrendingUp,
  FileUp,
  BarChart3,
  Target,
  Wallet,
  LayoutGrid,
  TrendingDown
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { ProjectUpload } from "../components/ProjectUpload";

interface ParticipantItemProps {
  uid: string;
  isOwner: boolean;
  key?: string;
}

function ParticipantItem({ uid, isOwner }: ParticipantItemProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, "users", uid)).then(d => {
      if (d.exists()) setProfile(d.data() as UserProfile);
    });
  }, [uid]);

  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-white/5">
          {profile?.name?.[0] || "?"}
        </div>
        <div>
          <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
            {profile?.name || "Загрузка..."}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
            {isOwner ? "Владелец" : "Участник"}
          </div>
        </div>
      </div>
      <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-white transition-all">
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<(ProjectComment & { author?: UserProfile })[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'plans' | 'commissions' | 'chat'>('overview');

  // Plan creation state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planTarget, setPlanTarget] = useState("");
  const [planType, setPlanType] = useState<'company' | 'personal'>('personal');
  const [planUser, setPlanUser] = useState("");

  const stats = {
    gross: bookings.reduce((sum, b) => sum + b.total, 0),
    cancelled: bookings.filter(b => b.status === 'cancelled').reduce((sum, b) => sum + b.total, 0),
    net: 0,
    cancelRate: 0,
  };
  stats.net = stats.gross - stats.cancelled;
  stats.cancelRate = bookings.length > 0 ? (bookings.filter(b => b.status === 'cancelled').length / bookings.length) * 100 : 0;

  useEffect(() => {
    console.log("ProjectDetails mounted with id:", id);
    if (!id || !user) return;

    // Subscribe to project details
    const unsubscribeProject = onSnapshot(
      doc(db, "projects", id),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProject({ 
            id: docSnap.id, 
            ...data,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
          } as Project);
        } else {
          toast.error("Проект не найден");
          navigate("/projects");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Project details error:", err);
        handleFirestoreError(err, OperationType.GET, `projects/${id}`);
        setLoading(false);
      }
    );

    // Subscribe to bookings
    const bookingsQuery = query(
      collection(db, "projects", id, "bookings"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const bookingsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
        setBookings(bookingsData);
      },
      (err) => {
        console.error("Bookings error:", err);
      }
    );

    // Subscribe to comments
    const commentsQuery = query(
      collection(db, "projects", id, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeComments = onSnapshot(
      commentsQuery,
      async (snapshot) => {
        const commentsData = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data() as ProjectComment;
          let author: UserProfile | undefined;
          try {
            const userDoc = await getDoc(doc(db, "users", data.authorUid));
            if (userDoc.exists()) author = userDoc.data() as UserProfile;
          } catch (e) {
            console.error("Error fetching comment author:", e);
          }
          return { id: d.id, ...data, author };
        }));
        setComments(commentsData);
      },
      (err) => {
        console.error("Comments error:", err);
        // Don't fail the whole page if comments fail
      }
    );

    // Subscribe to plans
    const plansQuery = query(
      collection(db, "projects", id, "plans"),
      orderBy("startDate", "desc")
    );

    const unsubscribePlans = onSnapshot(
      plansQuery,
      (snapshot) => {
        const plansData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Plan));
        setPlans(plansData);
      },
      (err) => {
        console.error("Plans error:", err);
      }
    );

    return () => {
      unsubscribeProject();
      unsubscribeBookings();
      unsubscribePlans();
      unsubscribeComments();
    };
  }, [id, user, navigate]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id || !user) return;
    setSending(true);

    try {
      await addDoc(collection(db, "projects", id, "comments"), {
        projectId: id,
        authorUid: user.uid,
        text: newComment.trim(),
        createdAt: serverTimestamp()
      });
      setNewComment("");
    } catch (error) {
      console.error("Add comment error:", error);
      toast.error("Ошибка при отправке комментария");
    } finally {
      setSending(false);
    }
  };

  const handleAddPlan = async () => {
    if (!id || !planTarget) return;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      await addDoc(collection(db, "projects", id, "plans"), {
        projectId: id,
        uid: planType === 'personal' ? (planUser || user?.uid) : null,
        type: planType,
        target: Number(planTarget),
        actual: 0,
        startDate: startOfMonth.toISOString(),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
        updatedAt: serverTimestamp()
      });
      
      setShowPlanModal(false);
      setPlanTarget("");
      toast.success("План успешно добавлен");
    } catch (error) {
      console.error("Add plan error:", error);
      toast.error("Ошибка при добавлении плана");
    }
  };

  const companyPlan = plans.find(p => p.type === 'company');
  const personalPlans = plans.filter(p => p.type === 'personal');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="text-white text-xl animate-pulse">Загрузка проекта...</div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={() => navigate("/projects")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Назад к проектам
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
              {project.title}
            </h1>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
              project.status === 'active' ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-700 text-slate-300'
            }`}>
              {project.status === 'active' ? 'Active' : project.status}
            </div>
          </div>
          <p className="text-xl text-slate-400 max-w-2xl font-serif italic leading-relaxed">
            {project.description || "У этого проекта пока нет описания. Добавьте его, чтобы участники понимали цели и задачи."}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl border border-white/10 transition-all active:scale-95">
            <UserPlus className="w-6 h-6" />
          </button>
          <button className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl border border-white/10 transition-all active:scale-95">
            <SettingsIcon className="w-6 h-6" />
          </button>
          <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
            Завершить
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'Обзор', icon: LayoutGrid },
          { id: 'bookings', label: 'Бронирования', icon: FileUp },
          { id: 'plans', label: 'Планы', icon: Target },
          { id: 'commissions', label: 'Комиссии', icon: Wallet },
          { id: 'chat', label: 'Обсуждение', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Weekly Review Summary */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-xl font-bold text-white">Еженедельный разбор</h3>
                  </div>
                  <button className="text-indigo-400 text-xs font-bold hover:underline">Добавить итоги</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Итоги недели</div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      План выполнен на 74%. Основной рост за счет прямых бронирований.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Проблемы</div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Высокий процент отмен с Booking.com (12%).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Задачи</div>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• Проверить настройки цен</li>
                      <li>• Обновить фото категории Люкс</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Net Продажи</div>
                  <div className="text-4xl font-black text-white tracking-tighter">
                    {stats.net.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <TrendingUp className="w-4 h-4" />
                    +0% к прошлой неделе
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Отмены</div>
                  <div className="text-4xl font-black text-white tracking-tighter">
                    {stats.cancelRate.toFixed(1)}%
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-bold">
                    Всего {bookings.length} бронирований
                  </div>
                </div>
              </div>

              {/* Top Sources / Sellers */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                <h3 className="text-xl font-bold text-white mb-6">Эффективность команды</h3>
                <div className="space-y-4">
                  {bookings.length > 0 ? (
                    <div className="space-y-4">
                      {/* Simple list of top bookings for now */}
                      {bookings.slice(0, 5).map(booking => (
                        <div key={booking.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-white/5">
                              {booking.source[0]}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white">{booking.code}</div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-widest">{booking.source}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-white">{booking.total.toLocaleString('ru-RU')} ₽</div>
                            <div className={`text-[10px] uppercase font-black ${booking.status === 'cancelled' ? 'text-red-500' : 'text-emerald-500'}`}>
                              {booking.status === 'cancelled' ? 'Отмена' : 'Активно'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-500 italic">
                      Загрузите отчеты, чтобы увидеть статистику
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <FileUp className="w-6 h-6 text-indigo-500" />
                    <h2 className="text-2xl font-bold text-white tracking-tight">Импорт Excel</h2>
                  </div>
                </div>
                <ProjectUpload projectId={id!} />
              </div>

              {bookings.length > 0 && (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <h3 className="text-xl font-bold text-white mb-6">Последние бронирования</h3>
                  <div className="space-y-3">
                    {bookings.slice(0, 10).map(booking => (
                      <div key={booking.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="text-xs font-mono text-slate-500">{booking.code}</div>
                          <div>
                            <div className="text-sm font-bold text-white">{booking.category}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-widest">{booking.source} • {booking.roomNumber}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">{booking.total.toLocaleString('ru-RU')} ₽</div>
                          <div className="text-[10px] text-slate-500">{new Date(booking.checkIn).toLocaleDateString('ru-RU')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight">Планы продаж</h2>
                <button 
                  onClick={() => setShowPlanModal(true)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
                >
                  <Target className="w-4 h-4" />
                  Установить план
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Company Plan Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-slate-500 text-xs font-black uppercase tracking-widest">План компании</div>
                    <div className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-bold uppercase">Текущий месяц</div>
                  </div>
                  {companyPlan ? (
                    <div className="space-y-6">
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-4xl font-black text-white tracking-tighter">
                            {stats.net.toLocaleString('ru-RU')} ₽
                          </div>
                          <div className="text-slate-500 text-xs font-bold mt-1">
                            из {companyPlan.target.toLocaleString('ru-RU')} ₽
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-indigo-400">
                            {((stats.net / companyPlan.target) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-1000"
                          style={{ width: `${Math.min(100, (stats.net / companyPlan.target) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 italic text-sm">
                      Общий план не установлен
                    </div>
                  )}
                </div>

                {/* Personal Plans List */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-6">Личные планы</div>
                  <div className="space-y-4">
                    {personalPlans.length > 0 ? (
                      personalPlans.map(plan => (
                        <div key={plan.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-bold text-white">
                              {project?.participants.find(p => p.uid === plan.uid)?.role || 'Участник'}
                            </div>
                            <div className="text-xs font-bold text-indigo-400">
                              {plan.target.toLocaleString('ru-RU')} ₽
                            </div>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500"
                              style={{ width: '0%' }} // Need to calculate per-user net sales
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500 italic text-sm">
                        Личные планы не установлены
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan Modal */}
              {showPlanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                  <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                    <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">Установить план</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Тип плана</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setPlanType('company')}
                            className={cn(
                              "py-3 rounded-2xl font-bold text-sm transition-all border",
                              planType === 'company' ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                            )}
                          >
                            Компания
                          </button>
                          <button 
                            onClick={() => setPlanType('personal')}
                            className={cn(
                              "py-3 rounded-2xl font-bold text-sm transition-all border",
                              planType === 'personal' ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                            )}
                          >
                            Личный
                          </button>
                        </div>
                      </div>
                      
                      {planType === 'personal' && (
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Сотрудник</label>
                          <select 
                            value={planUser}
                            onChange={(e) => setPlanUser(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none"
                          >
                            <option value="">Выберите сотрудника</option>
                            {project?.participant_uids.map(uid => (
                              <option key={uid} value={uid}>{uid === user?.uid ? 'Я' : uid}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Цель (₽)</label>
                        <input 
                          type="number"
                          value={planTarget}
                          onChange={(e) => setPlanTarget(e.target.value)}
                          placeholder="Например: 1000000"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                      </div>

                      <div className="flex gap-3 mt-8">
                        <button 
                          onClick={() => setShowPlanModal(false)}
                          className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-bold text-sm transition-all"
                        >
                          Отмена
                        </button>
                        <button 
                          onClick={handleAddPlan}
                          className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'commissions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight">Расчет комиссий</h2>
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400">
                  Автоматический расчет
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {personalPlans.length > 0 ? (
                  personalPlans.map(plan => {
                    // Simple on-the-fly calculation for demo
                    const userBookings = bookings.filter(b => b.sellerUid === plan.uid);
                    const gross = userBookings.reduce((sum, b) => sum + b.total, 0);
                    const cancelled = userBookings.filter(b => b.status === 'cancelled').reduce((sum, b) => sum + b.total, 0);
                    const net = gross - cancelled;
                    const achievement = plan.target > 0 ? (net / plan.target) * 100 : 0;
                    
                    let rate = 0.03;
                    if (achievement >= 80) rate = 0.06;
                    else if (achievement >= 50) rate = 0.05;

                    const companyAchievement = companyPlan && companyPlan.target > 0 ? (stats.net / companyPlan.target) * 100 : 0;
                    const bonus = companyAchievement >= 100 ? 0.02 : 0;
                    const totalRate = rate + bonus;
                    const amount = net * totalRate;

                    return (
                      <div key={plan.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/20">
                              {project?.participants.find(p => p.uid === plan.uid)?.role?.[0] || 'У'}
                            </div>
                            <div>
                              <div className="text-lg font-bold text-white">
                                {project?.participants.find(p => p.uid === plan.uid)?.role || 'Участник'}
                              </div>
                              <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                Выполнение: {achievement.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            <div>
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Net Продажи</div>
                              <div className="text-lg font-bold text-white">{net.toLocaleString('ru-RU')} ₽</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Ставка</div>
                              <div className="text-lg font-bold text-emerald-400">{(rate * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Бонус</div>
                              <div className="text-lg font-bold text-blue-400">{(bonus * 100).toFixed(0)}%</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">К выплате</div>
                              <div className="text-xl font-black text-white">{amount.toLocaleString('ru-RU')} ₽</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-12 text-center">
                    <Wallet className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 italic">Установите планы, чтобы увидеть расчет комиссий</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
              <div className="flex items-center gap-3 mb-8">
                <MessageSquare className="w-6 h-6 text-indigo-500" />
                <h2 className="text-2xl font-bold text-white tracking-tight">Обсуждение</h2>
              </div>

              <div className="space-y-8 mb-8 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {comments.length > 0 ? (comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold shrink-0 border border-white/5">
                      {comment.author?.name?.[0] || "?"}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{comment.author?.name || "Аноним"}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                          {comment.createdAt instanceof Timestamp ? comment.createdAt.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ""}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 group-hover:border-white/10 transition-colors">
                        {comment.text}
                      </p>
                    </div>
                  </div>
                ))) : (
                  <div className="text-center py-12 text-slate-500 italic">
                    Пока нет комментариев. Будьте первым!
                  </div>
                )}
              </div>

              <form onSubmit={handleAddComment} className="relative">
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Напишите что-нибудь..."
                  className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all h-24 resize-none"
                />
                <button 
                  type="submit"
                  disabled={sending || !newComment.trim()}
                  className="absolute right-3 bottom-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white p-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Sidebar - Info/Participants */}
        <div className="space-y-6">
          {/* Stats Card */}
          <div className="bg-indigo-500 rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-500/20">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Прогресс</span>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-6xl font-black italic tracking-tighter mb-2">74%</div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white w-[74%]" />
            </div>
            <p className="mt-4 text-sm font-medium opacity-80">
              Проект движется по графику. Осталось 3 задачи до завершения этапа.
            </p>
          </div>

          {/* Participants Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="text-xl font-bold text-white">Команда</h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">{project.participant_uids.length}</span>
            </div>
            <div className="space-y-4">
              {project.participant_uids.map((uid) => (
                <ParticipantItem key={uid} uid={uid} isOwner={uid === project.owner_uid} />
              ))}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-indigo-500" />
              <h3 className="text-xl font-bold text-white">История</h3>
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-px bg-white/10 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500" />
                </div>
                <div className="pb-4">
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Сегодня</div>
                  <p className="text-sm text-slate-300">Проект был обновлен</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-px bg-white/10 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/20" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">
                    {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                  </div>
                  <p className="text-sm text-slate-300">Создание проекта</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
