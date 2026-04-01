import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, handleFirestoreError, OperationType, safeSnapshot } from "../firebase";
import { 
  doc, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  getDoc,
  Timestamp,
  updateDoc,
  deleteDoc,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  setDoc
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Project, ProjectComment, UserProfile, Booking, Plan, ProjectParticipant } from "../types";
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
  TrendingDown,
  Search,
  X,
  Shield,
  UserMinus,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { ProjectUpload } from "../components/ProjectUpload";

interface ParticipantItemProps {
  uid: string;
  isOwner: boolean;
  role?: string;
  onRemove?: () => void | Promise<void>;
  onChangeRole?: (role: 'manager' | 'seller') => void | Promise<void>;
  canManage: boolean;
}

const ParticipantItem: React.FC<ParticipantItemProps> = ({ uid, isOwner, role, onRemove, onChangeRole, canManage }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, "users", uid)).then(d => {
      if (d.exists()) setProfile(d.data() as UserProfile);
    });
  }, [uid]);

  const [showMenu, setShowMenu] = useState(false);

  const roleLabels = {
    owner: 'Владелец',
    manager: 'Менеджер',
    seller: 'Продавец'
  };

  const displayRole = isOwner ? 'owner' : (role || 'seller');

  return (
    <div className={cn("flex items-center justify-between group relative", showMenu ? "z-30" : "z-0")}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-white/5">
          {profile?.name?.[0] || "?"}
        </div>
        <div>
          <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
            {profile?.name || "Загрузка..."}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
            {roleLabels[displayRole as keyof typeof roleLabels] || "Участник"}
          </div>
        </div>
      </div>
      
      {canManage && !isOwner && (
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-white transition-all p-2"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-20 py-2 animate-in fade-in zoom-in-95 duration-100">
                {role !== 'manager' && onChangeRole && (
                  <button 
                    onClick={() => {
                      onChangeRole('manager');
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <Shield className="w-3 h-3" />
                    Сделать менеджером
                  </button>
                )}
                {role !== 'seller' && onChangeRole && (
                  <button 
                    onClick={() => {
                      onChangeRole('seller');
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <Users className="w-3 h-3" />
                    Сделать продавцом
                  </button>
                )}
                {onRemove && (
                  <button 
                    onClick={() => {
                      onRemove();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors flex items-center gap-2"
                  >
                    <UserMinus className="w-3 h-3" />
                    Удалить из проекта
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const WarningBanner = ({ message }: { message: string }) => (
  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
    <p className="text-sm text-amber-200/80 font-medium">{message}</p>
  </div>
);

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [projectParticipants, setProjectParticipants] = useState<ProjectParticipant[]>([]);
  const [comments, setComments] = useState<(ProjectComment & { author?: UserProfile })[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subErrors, setSubErrors] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'plans' | 'commissions' | 'chat'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Modals state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Plan creation state
  const [planTarget, setPlanTarget] = useState("");
  const [planType, setPlanType] = useState<'company' | 'personal'>('personal');
  const [planUser, setPlanUser] = useState("");

  const isOwner = user?.uid === project?.owner_uid;
  const userParticipant = projectParticipants.find(p => p.uid === user?.uid);
  const isParticipant = isOwner || project?.participant_uids?.includes(user?.uid || "");
  const canManage = isOwner || userParticipant?.role === 'manager';

  const filteredByMonthBookings = bookings.filter(b => {
    const date = b.saleDate || b.bookingDate;
    return date && date.startsWith(selectedMonth);
  });

  const stats = {
    gross: filteredByMonthBookings.reduce((sum, b) => sum + b.total, 0),
    cancelled: filteredByMonthBookings.filter(b => b.status === 'cancelled').reduce((sum, b) => sum + b.total, 0),
    net: 0,
    cancelRate: 0,
  };
  stats.net = stats.gross - stats.cancelled;
  stats.cancelRate = filteredByMonthBookings.length > 0 ? (filteredByMonthBookings.filter(b => b.status === 'cancelled').length / filteredByMonthBookings.length) * 100 : 0;

  useEffect(() => {
    console.log("ProjectDetails mounted with id:", id);
    if (!id || !user) return;

    let isMounted = true;

    // Subscribe to project details
    const unsubscribeProject = safeSnapshot(
      doc(db, "projects", id),
      (docSnap: any) => {
        if (!isMounted) return;
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProject({ 
            id: docSnap.id, 
            ...data,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
          } as Project);
          setError(null);
        } else {
          toast.error("Проект не найден");
          navigate("/projects");
        }
        setLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Project details error:", err);
        if (err.code === 'permission-denied') {
          setError("У вас нет прав для просмотра этого проекта или он был удален.");
        }
        setLoading(false);
      },
      OperationType.GET,
      `projects/${id}`
    );

    // Subscribe to bookings
    const bookingsQuery = query(
      collection(db, "projects", id, "bookings"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeBookings = safeSnapshot(
      bookingsQuery,
      (snapshot: any) => {
        if (!isMounted) return;
        const bookingsData = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Booking));
        setBookings(bookingsData);
        setSubErrors(prev => ({ ...prev, bookings: false }));
      },
      (err) => {
        if (!isMounted) return;
        console.error("Bookings error:", err);
        setSubErrors(prev => ({ ...prev, bookings: true }));
      },
      OperationType.GET,
      `projects/${id}/bookings`
    );

    // Subscribe to comments
    const commentsQuery = query(
      collection(db, "projects", id, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeComments = safeSnapshot(
      commentsQuery,
      async (snapshot: any) => {
        if (!isMounted) return;
        const commentsData = await Promise.all(snapshot.docs.map(async (d: any) => {
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
        if (isMounted) setComments(commentsData);
      },
      (err) => {
        if (!isMounted) return;
        console.error("Comments error:", err);
        setSubErrors(prev => ({ ...prev, chat: true }));
      },
      OperationType.GET,
      `projects/${id}/comments`
    );

    // Subscribe to plans
    const plansQuery = query(
      collection(db, "projects", id, "plans"),
      orderBy("startDate", "desc")
    );

    const unsubscribePlans = safeSnapshot(
      plansQuery,
      (snapshot: any) => {
        if (!isMounted) return;
        const plansData = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Plan));
        setPlans(plansData);
        setSubErrors(prev => ({ ...prev, plans: false }));
      },
      (err) => {
        if (!isMounted) return;
        console.error("Plans error:", err);
        setSubErrors(prev => ({ ...prev, plans: true }));
      },
      OperationType.GET,
      `projects/${id}/plans`
    );

    // Subscribe to participants
    const participantsQuery = collection(db, "projects", id, "participants");
    const unsubscribeParticipants = safeSnapshot(
      participantsQuery,
      (snapshot: any) => {
        if (!isMounted) return;
        const participantsData = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as ProjectParticipant));
        setProjectParticipants(participantsData);
        setSubErrors(prev => ({ ...prev, participants: false }));
      },
      (err) => {
        if (!isMounted) return;
        console.error("Participants error:", err);
        setSubErrors(prev => ({ ...prev, participants: true }));
      },
      OperationType.GET,
      `projects/${id}/participants`
    );

    return () => {
      isMounted = false;
      unsubscribeProject();
      unsubscribeBookings();
      unsubscribePlans();
      unsubscribeComments();
      unsubscribeParticipants();
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
    if (!id || !planTarget || !user) return;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const path = `projects/${id}/plans`;
      await addDoc(collection(db, path), {
        projectId: id,
        uid: planType === 'personal' ? (planUser || user.uid) : null,
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
      handleFirestoreError(error, OperationType.CREATE, `projects/${id}/plans`);
      toast.error("Ошибка при добавлении плана");
    }
  };

  const handleCompleteProject = async () => {
    if (!id || !project || !isOwner) return;
    try {
      await updateDoc(doc(db, "projects", id), {
        status: project.status === 'completed' ? 'active' : 'completed',
        updatedAt: serverTimestamp()
      });
      toast.success(project.status === 'completed' ? "Проект возобновлен" : "Проект завершен");
    } catch (error) {
      console.error("Complete project error:", error);
      toast.error("Ошибка при изменении статуса проекта");
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !canManage) return;
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    try {
      await updateDoc(doc(db, "projects", id), {
        title,
        description,
        updatedAt: serverTimestamp()
      });
      setShowSettingsModal(false);
      toast.success("Настройки обновлены");
    } catch (error) {
      console.error("Update settings error:", error);
      toast.error("Ошибка при обновлении настроек");
    }
  };

  const handleRemoveParticipant = async (participantUid: string) => {
    if (!id || !canManage || participantUid === project?.owner_uid) return;
    try {
      await updateDoc(doc(db, "projects", id), {
        participant_uids: arrayRemove(participantUid)
      });
      await deleteDoc(doc(db, "projects", id, "participants", participantUid));
      toast.success("Участник удален");
    } catch (error) {
      console.error("Remove participant error:", error);
      toast.error("Ошибка при удалении участника");
    }
  };

  const handleChangeRole = async (participantUid: string, newRole: 'manager' | 'seller') => {
    if (!id || !canManage || participantUid === project?.owner_uid) return;
    try {
      await updateDoc(doc(db, "projects", id, "participants", participantUid), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      toast.success("Роль изменена");
    } catch (error) {
      console.error("Change role error:", error);
      toast.error("Ошибка при изменении роли");
    }
  };

  const handleAddParticipant = async (userProfile: UserProfile) => {
    if (!id || !canManage) return;
    if (project?.participant_uids.includes(userProfile.uid)) {
      toast.error("Пользователь уже в проекте");
      return;
    }

    try {
      await updateDoc(doc(db, "projects", id), {
        participant_uids: arrayUnion(userProfile.uid)
      });
      await setDoc(doc(db, "projects", id, "participants", userProfile.uid), {
        uid: userProfile.uid,
        role: 'seller',
        active: true,
        commissionBaseRate: 0.03,
        joinedAt: serverTimestamp()
      });
      setShowUserSearch(false);
      toast.success("Участник добавлен");
    } catch (error) {
      console.error("Add participant error:", error);
      toast.error("Ошибка при добавлении участника");
    }
  };

  const companyPlan = plans.find(p => p.type === 'company');
  const personalPlans = plans.filter(p => p.type === 'personal');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="text-white text-xl animate-pulse font-bold tracking-widest uppercase">Загрузка проекта...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Ошибка доступа</h2>
          <p className="text-slate-400 leading-relaxed">{error}</p>
        </div>
        <button 
          onClick={() => navigate("/projects")}
          className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest border border-white/10 transition-all"
        >
          Вернуться к проектам
        </button>
      </div>
    );
  }

  if (!project) return null;

  const WarningBanner = ({ message }: { message: string }) => (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-top-2">
      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
      <p className="text-sm text-amber-200 font-medium">{message}</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Warning Banners */}
      {Object.values(subErrors).some(v => v) && (
        <WarningBanner message="Некоторые данные проекта временно недоступны. Проверьте соединение или права доступа." />
      )}

      {/* Warning Banner for sub-errors */}
      {Object.values(subErrors).some(v => v) && (
        <WarningBanner message="Некоторые данные (участники, планы или чат) временно недоступны из-за ограничений доступа. Мы используем сохраненные данные проекта." />
      )}

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
          {canManage && (
            <button 
              onClick={() => setShowUserSearch(true)}
              className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              <UserPlus className="w-6 h-6" />
            </button>
          )}
          {canManage && (
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              <SettingsIcon className="w-6 h-6" />
            </button>
          )}
          {isOwner && (
            <button 
              onClick={handleCompleteProject}
              className={cn(
                "px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg",
                project.status === 'completed' 
                  ? "bg-slate-700 hover:bg-slate-600 text-slate-300" 
                  : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/20"
              )}
            >
              {project.status === 'completed' ? 'Возобновить' : 'Завершить'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs & Month Selector */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
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

        <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-1 rounded-2xl">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-white text-sm font-bold px-4 py-2 focus:outline-none [color-scheme:dark]"
          />
        </div>
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
                  <button 
                    onClick={() => toast.info("Добавление итогов в разработке")}
                    className="text-indigo-400 text-xs font-bold hover:underline"
                  >
                    Добавить итоги
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Итоги месяца</div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      План выполнен на {((stats.net / (companyPlan?.target || 1)) * 100).toFixed(1)}%. 
                      {stats.net >= (companyPlan?.target || 0) ? " План выполнен!" : " Нужно поднажать."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Проблемы</div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Процент отмен: {stats.cancelRate.toFixed(1)}%. 
                      {stats.cancelRate > 15 ? " Критический уровень отмен!" : " В пределах нормы."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Задачи</div>
                    <ul className="text-sm text-slate-300 space-y-1">
                      <li>• Проверить отчеты за {selectedMonth}</li>
                      <li>• Сверить комиссии</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Net Продажи ({selectedMonth})</div>
                  <div className="text-4xl font-black text-white tracking-tighter">
                    {stats.net.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <TrendingUp className="w-4 h-4" />
                    Всего {filteredByMonthBookings.length} бронирований
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Отмены</div>
                  <div className="text-4xl font-black text-white tracking-tighter">
                    {stats.cancelRate.toFixed(1)}%
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-bold">
                    Сумма отмен: {stats.cancelled.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </div>

              {/* Top Sources / Sellers */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                <h3 className="text-xl font-bold text-white mb-6">Эффективность за {selectedMonth}</h3>
                <div className="space-y-4">
                  {filteredByMonthBookings.length > 0 ? (
                    <div className="space-y-4">
                      {filteredByMonthBookings.slice(0, 5).map(booking => (
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
                      Нет данных за выбранный период
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
                      personalPlans.map(plan => {
                        const userBookings = filteredByMonthBookings.filter(b => b.sellerUid === plan.uid);
                        const userNet = userBookings.reduce((sum, b) => sum + (b.status === 'cancelled' ? 0 : b.total), 0);
                        const progress = plan.target > 0 ? (userNet / plan.target) * 100 : 0;

                        return (
                          <div key={plan.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-bold text-white">
                                {projectParticipants.find((p: any) => p.uid === plan.uid)?.role || 'Участник'}
                              </div>
                              <div className="text-xs font-bold text-indigo-400">
                                {userNet.toLocaleString('ru-RU')} / {plan.target.toLocaleString('ru-RU')} ₽
                              </div>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 transition-all duration-1000"
                                style={{ width: `${Math.min(100, progress)}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-right text-slate-500 font-bold">
                              {progress.toFixed(1)}%
                            </div>
                          </div>
                        );
                      })
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
                            {project?.participant_uids?.map(uid => (
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
                    const userBookings = filteredByMonthBookings.filter(b => b.sellerUid === plan.uid);
                    const gross = userBookings.reduce((sum, b) => sum + b.total, 0);
                    const cancelled = userBookings.filter(b => b.status === 'cancelled').reduce((sum, b) => sum + b.total, 0);
                    const net = gross - cancelled;
                    const achievement = plan.target > 0 ? (net / plan.target) * 100 : 0;
                    
                    // Get base rate from participant data if available
                    const participant = projectParticipants.find((p: any) => p.uid === plan.uid);
                    let rate = participant?.commissionBaseRate || 0.03;
                    
                    // Progressive rate logic (example from TZ context)
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
                              {participant?.role?.[0] || 'У'}
                            </div>
                            <div>
                              <div className="text-lg font-bold text-white">
                                {participant?.role || 'Участник'}
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
                              <div className="text-lg font-bold text-emerald-400">{(rate * 100).toFixed(1)}%</div>
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
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Прогресс плана</span>
              <Target className="w-6 h-6" />
            </div>
            <div className="text-6xl font-black italic tracking-tighter mb-2">
              {((stats.net / (companyPlan?.target || 1)) * 100).toFixed(0)}%
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-1000" 
                style={{ width: `${Math.min(100, (stats.net / (companyPlan?.target || 1)) * 100)}%` }}
              />
            </div>
            <p className="mt-4 text-sm font-medium opacity-80">
              {stats.net >= (companyPlan?.target || 0) 
                ? "Общий план на месяц выполнен! Команда получит бонус +2%." 
                : `До выполнения плана осталось ${(Math.max(0, (companyPlan?.target || 0) - stats.net)).toLocaleString('ru-RU')} ₽.`}
            </p>
          </div>

          {/* Participants Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="text-xl font-bold text-white">Команда</h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">{project?.participant_uids?.length || 0}</span>
            </div>
              <div className="space-y-4">
                {project?.participant_uids?.map((uid) => {
                  const participantData = projectParticipants.find(p => p.uid === uid);
                  return (
                    <ParticipantItem 
                      key={uid} 
                      uid={uid} 
                      isOwner={uid === project.owner_uid} 
                      role={participantData?.role}
                      canManage={canManage}
                      onRemove={() => handleRemoveParticipant(uid)}
                      onChangeRole={(newRole) => handleChangeRole(uid, newRole)}
                    />
                  );
                })}
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
                    {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('ru-RU') : "Неизвестно"}
                  </div>
                  <p className="text-sm text-slate-300">Создание проекта</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">Настройки проекта</h3>
            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Название</label>
                <input 
                  name="title"
                  defaultValue={project?.title}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Описание</label>
                <textarea 
                  name="description"
                  defaultValue={project?.description}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all h-24 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-bold text-sm transition-all"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Search Modal */}
      {showUserSearch && (
        <UserSearchModal 
          onClose={() => setShowUserSearch(false)} 
          onSelect={handleAddParticipant} 
        />
      )}
    </div>
  );
}

function UserSearchModal({ onClose, onSelect }: { onClose: () => void, onSelect: (user: UserProfile) => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", search.trim())
      );
      const snap = await getDocs(q);
      setResults(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Ошибка при поиске");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white tracking-tight">Добавить участника</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSearch} className="relative mb-6">
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email пользователя..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        </form>

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Поиск...</div>
          ) : results.length > 0 ? (
            results.map(user => (
              <button 
                key={user.uid}
                onClick={() => onSelect(user)}
                className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-white/5">
                  {user.name?.[0] || "?"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{user.name}</div>
                  <div className="text-[10px] text-slate-500">{user.email}</div>
                </div>
                <UserPlus className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))
          ) : search && (
            <div className="text-center py-8 text-slate-500 italic">Пользователь не найден</div>
          )}
        </div>
      </div>
    </div>
  );
}
