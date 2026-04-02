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
  setDoc,
  limit
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Project, ProjectComment, UserProfile, Booking, Plan, ProjectParticipant } from "../types";
import { calculateCommissions } from "../services/commissionService";
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
  AlertTriangle,
  CheckSquare,
  History, 
  Lock, 
  Unlock, 
  Camera, 
  RotateCcw, 
  ListFilter
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { ProjectUpload } from "../components/ProjectUpload";
import { clearMonthData, clearAllProjectData } from "../services/cleanupService";
import { getMonthConfig, lockMonth, unlockMonth } from "../services/monthService";
import { createSnapshot, getSnapshots, rollbackToSnapshot } from "../services/snapshotService";
import { logAction } from "../services/auditService";
import { MonthConfig, CalculationSnapshot, Commission, AuditLog } from "../types";

import { MonthlyCycleWizard } from "../components/MonthlyCycleWizard";

interface ParticipantItemProps {
  uid: string;
  isOwner: boolean;
  role?: string;
  onRemove?: () => void | Promise<void>;
  onChangeRole?: (role: 'manager' | 'seller' | 'tech') => void | Promise<void>;
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
    seller: 'Продавец',
    tech: 'Тех. отдел'
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
                {role !== 'tech' && onChangeRole && (
                  <button 
                    onClick={() => {
                      onChangeRole('tech');
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <CheckSquare className="w-3 h-3" />
                    Тех. отдел
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
  const { user, profile } = useAuth();
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
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'plans' | 'commissions' | 'chat' | 'snapshots' | 'audit' | 'tasks'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [monthMode, setMonthMode] = useState<'sale' | 'checkin'>('sale');
  const [efficiencyPeriod, setEfficiencyPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Month Locking & Snapshots
  const [monthConfig, setMonthConfig] = useState<MonthConfig | null>(null);
  const [snapshots, setSnapshots] = useState<CalculationSnapshot[]>([]);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState("");
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [isLocking, setIsLocking] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState<'month' | 'all' | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);
  
  // Plan creation state
  const [planTarget, setPlanTarget] = useState("");
  const [planType, setPlanType] = useState<'company' | 'personal'>('personal');
  const [planUser, setPlanUser] = useState("");

  const isOwner = user?.uid === project?.owner_uid;
  const userParticipant = projectParticipants.find(p => p.uid === user?.uid);
  const isParticipant = isOwner || project?.participant_uids?.includes(user?.uid || "");
  const canManage = isOwner || userParticipant?.role === 'manager';

  const filteredByMonthBookings = bookings.filter((b: any) => {
    const key = monthMode === 'sale'
      ? (b.saleMonthKey || b.bookingMonthKey)
      : b.checkInMonthKey;
    return key === selectedMonth;
  });

  const prettyDate = (iso?: string | null) => {
    if (!iso) return "Дата не указана";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "Дата не указана" : d.toLocaleDateString("ru-RU");
  };

  const roleByUid = new Map(projectParticipants.map(p => [p.uid, p.role]));

  const getParticipantRole = (uid?: string | null) => {
    if (!uid) return "Участник";
    if (project?.owner_uid === uid) return "Владелец";
    const r = roleByUid.get(uid);
    if (r === "manager") return "Менеджер";
    if (r === "seller") return "Продавец";
    return "Участник";
  };

  const handleCleanup = async () => {
    if (cleanupConfirmText !== "ОЧИСТИТЬ") {
      toast.error("Введите слово ОЧИСТИТЬ для подтверждения");
      return;
    }

    setIsCleaning(true);
    try {
      const role = getParticipantRole(user!.uid);
      if (showCleanupModal === 'month') {
        await clearMonthData(id!, selectedMonth, user!.uid, role);
        toast.success(`Данные за ${selectedMonth} успешно очищены`);
      } else if (showCleanupModal === 'all') {
        await clearAllProjectData(id!, user!.uid, role);
        toast.success("Все данные проекта успешно очищены");
      }
      setShowCleanupModal(null);
      setCleanupConfirmText("");
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error("Ошибка при очистке данных");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleLock = async () => {
    if (!id || !user) return;
    setIsLocking(true);
    try {
      const role = getParticipantRole(user.uid);
      await lockMonth(id, selectedMonth, user.uid, role);
      toast.success("Месяц успешно заблокирован");
    } catch (err) {
      console.error("Lock error:", err);
      toast.error("Ошибка при блокировке месяца");
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!id || !user || !unlockReason) return;
    setIsLocking(true);
    try {
      const role = getParticipantRole(user.uid);
      await unlockMonth(id, selectedMonth, user.uid, role, unlockReason);
      toast.success("Месяц разблокирован");
      setShowUnlockModal(false);
      setUnlockReason("");
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error("Ошибка при разблокировке месяца");
    } finally {
      setIsLocking(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!id || !user) return;
    setIsSnapshotting(true);
    try {
      const role = getParticipantRole(user.uid);
      const personalPlans = plans.filter(p => p.type === 'personal' && p.period === 'month');
      const companyPlan = plans.find(p => p.type === 'company' && p.period === 'month') || null;
      
      const results = calculateCommissions(
        filteredByMonthBookings,
        personalPlans,
        companyPlan,
        projectParticipants,
        stats.net
      );

      const commissions: Commission[] = results.map(r => ({
        id: `${r.uid}_${selectedMonth}`,
        projectId: id,
        uid: r.uid,
        month: selectedMonth,
        gross: filteredByMonthBookings.filter(b => b.sellerUid === r.uid).reduce((sum, b) => sum + b.total, 0),
        cancelled: filteredByMonthBookings.filter(b => b.sellerUid === r.uid && b.status === 'cancelled').reduce((sum, b) => sum + b.total, 0),
        net: r.netSales,
        baseRate: r.baseRate,
        bonusRate: r.bonusRate,
        penaltyRate: r.penaltyRate,
        finalRate: r.finalRate,
        finalAmount: r.amount,
        updatedAt: new Date().toISOString()
      }));

      await createSnapshot(id, selectedMonth, user.uid, role, snapshotNote, commissions, stats);
      toast.success("Снапшот создан");
      setShowSnapshotModal(false);
      setSnapshotNote("");
    } catch (err) {
      console.error("Snapshot error:", err);
      toast.error("Ошибка при создании снапшота");
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleRollback = async (snapshot: CalculationSnapshot) => {
    if (!id || !user) return;
    if (!window.confirm(`Вы уверены, что хотите откатиться к версии ${snapshot.version}? Текущие расчеты будут перезаписаны.`)) return;
    
    try {
      const role = getParticipantRole(user.uid);
      await rollbackToSnapshot(id, snapshot, user.uid, role);
      toast.success(`Откат к версии ${snapshot.version} выполнен`);
    } catch (err) {
      console.error("Rollback error:", err);
      toast.error("Ошибка при откате");
    }
  };

  const stats = {
    gross: filteredByMonthBookings.reduce((sum, b) => sum + b.total, 0),
    cancelled: filteredByMonthBookings.filter(b => b.status === 'cancelled').reduce((sum, b) => sum + b.total, 0),
    net: 0,
    cancelRate: 0,
    sellerRevenue: 0,
    nonSellerRevenue: 0,
    nonSellerBySource: {} as Record<string, number>,
  };

  filteredByMonthBookings.forEach(b => {
    const isCancelled = b.status === 'cancelled';
    const amount = isCancelled ? 0 : b.total;
    if (b.sellerUid) {
      stats.sellerRevenue += amount;
    } else {
      stats.nonSellerRevenue += amount;
      const source = b.source || 'Unknown';
      stats.nonSellerBySource[source] = (stats.nonSellerBySource[source] || 0) + amount;
    }
  });

  stats.net = stats.gross - stats.cancelled;
  stats.cancelRate = filteredByMonthBookings.length > 0 ? (filteredByMonthBookings.filter(b => b.status === 'cancelled').length / filteredByMonthBookings.length) * 100 : 0;

  // Efficiency filtering
  const efficiencyBookings = bookings.filter((b: any) => {
    const dateStr = monthMode === 'sale' 
      ? (b.saleDateIso || b.bookingDateIso) 
      : b.checkInIso;
    if (!dateStr) return false;
    
    const date = new Date(dateStr);
    const now = new Date();
    
    if (efficiencyPeriod === 'year') {
      return date.getFullYear() === now.getFullYear();
    } else if (efficiencyPeriod === 'month') {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    } else if (efficiencyPeriod === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return date >= startOfWeek && date <= now;
    }
    return false;
  });

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

    // Subscribe to month config
    const unsubscribeMonthConfig = safeSnapshot(
      doc(db, "projects", id, "month_configs", selectedMonth),
      (docSnap: any) => {
        if (!isMounted) return;
        if (docSnap.exists()) {
          setMonthConfig({ id: docSnap.id, ...docSnap.data() } as MonthConfig);
        } else {
          setMonthConfig(null);
        }
      },
      (err) => {
        if (!isMounted) return;
        console.error("Month config error:", err);
      },
      OperationType.GET,
      `projects/${id}/month_configs/${selectedMonth}`
    );

    // Subscribe to snapshots
    const snapshotsQuery = query(
      collection(db, "projects", id, "snapshots"),
      where("monthKey", "==", selectedMonth),
      orderBy("version", "desc")
    );
    const unsubscribeSnapshots = safeSnapshot(
      snapshotsQuery,
      (snapshot: any) => {
        if (!isMounted) return;
        setSnapshots(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as CalculationSnapshot)));
      },
      (err) => {
        if (!isMounted) return;
        console.error("Snapshots error:", err);
      },
      OperationType.GET,
      `projects/${id}/snapshots`
    );

    return () => {
      isMounted = false;
      unsubscribeProject();
      unsubscribeBookings();
      unsubscribePlans();
      unsubscribeComments();
      unsubscribeParticipants();
      unsubscribeMonthConfig();
      unsubscribeSnapshots();
    };
  }, [id, user, navigate, selectedMonth]);

  useEffect(() => {
    if (activeTab !== 'audit' || !id) return;
    
    const q = query(
      collection(db, "audit_logs"),
      where("project_id", "==", id),
      orderBy("created_at", "desc"),
      limit(50)
    );

    const unsubscribe = safeSnapshot(
      q,
      (snapshot: any) => {
        setAuditLogs(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as AuditLog)));
      },
      (err) => console.error("Audit logs error:", err),
      OperationType.GET,
      `audit_logs`
    );

    return () => unsubscribe();
  }, [activeTab, id]);

  // Fallback logic for participants when sub-collection is inaccessible
  useEffect(() => {
    if (subErrors.participants && project) {
      const fallbackParticipants: ProjectParticipant[] = [];
      
      // Add owner
      fallbackParticipants.push({
        id: project.owner_uid,
        uid: project.owner_uid,
        role: 'owner',
        active: true,
        commissionBaseRate: 0.03
      } as ProjectParticipant);
      
      // Add other participants from participant_uids
      project.participant_uids?.forEach(uid => {
        if (uid !== project.owner_uid) {
          fallbackParticipants.push({
            id: uid,
            uid: uid,
            role: 'seller',
            active: true,
            commissionBaseRate: 0.03
          } as ProjectParticipant);
        }
      });
      
      setProjectParticipants(fallbackParticipants);
    }
  }, [subErrors.participants, project]);

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
      
      await logAction({
        action: 'remove_participant',
        actor_uid: user?.uid || '',
        actor_role: getParticipantRole(user?.uid),
        project_id: id,
        entity: 'participant',
        entity_id: participantUid,
        before_json: { uid: participantUid }
      });

      toast.success("Участник удален");
    } catch (error) {
      console.error("Remove participant error:", error);
      toast.error("Ошибка при удалении участника");
    }
  };

  const handleChangeRole = async (participantUid: string, newRole: 'manager' | 'seller' | 'tech') => {
    if (!id || !canManage || participantUid === project?.owner_uid) return;
    try {
      const before = projectParticipants.find(p => p.uid === participantUid);
      await updateDoc(doc(db, "projects", id, "participants", participantUid), {
        role: newRole,
        updatedAt: serverTimestamp()
      });

      await logAction({
        action: 'change_role',
        actor_uid: user?.uid || '',
        actor_role: getParticipantRole(user?.uid),
        project_id: id,
        entity: 'participant',
        entity_id: participantUid,
        before_json: before,
        after_json: { role: newRole }
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

      await logAction({
        action: 'add_participant',
        actor_uid: user?.uid || '',
        actor_role: getParticipantRole(user?.uid),
        project_id: id,
        entity: 'participant',
        entity_id: userProfile.uid,
        after_json: { uid: userProfile.uid, role: 'seller' }
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
      {subErrors.participants && (
        <WarningBanner message="Роли участников недоступны, показан базовый список." />
      )}
      {Object.values(subErrors).some((v, i) => v && Object.keys(subErrors)[i] !== 'participants') && (
        <WarningBanner message="Некоторые данные проекта временно недоступны. Проверьте соединение или права доступа." />
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
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit overflow-x-auto max-w-full no-scrollbar">
          {[
            { id: 'overview', label: 'Обзор', icon: LayoutGrid },
            { id: 'tasks', label: 'Задачи', icon: CheckSquare },
            { id: 'bookings', label: 'Бронирования', icon: FileUp, restricted: profile?.role === 'tech' },
            { id: 'plans', label: 'Планы', icon: Target, restricted: profile?.role === 'tech' },
            { id: 'commissions', label: 'Комиссии', icon: Wallet, restricted: profile?.role === 'tech' },
            { id: 'snapshots', label: 'Версии', icon: History, restricted: profile?.role === 'tech' },
            { id: 'audit', label: 'Аудит', icon: Shield, restricted: profile?.role === 'tech' },
            { id: 'chat', label: 'Обсуждение', icon: MessageSquare },
          ].filter(tab => !tab.restricted).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
          <div className="flex bg-black/20 rounded-xl p-1">
            <button 
              onClick={() => setMonthMode('sale')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                monthMode === 'sale' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Продажа
            </button>
            <button 
              onClick={() => setMonthMode('checkin')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                monthMode === 'checkin' ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Заезд
            </button>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-white text-sm font-bold px-2 py-1 focus:outline-none [color-scheme:dark]"
          />
          <div className="w-px h-4 bg-white/10" />
          {monthConfig?.status === 'locked' ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-black uppercase tracking-widest">
              <Lock className="w-3 h-3" />
              Locked
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <Unlock className="w-3 h-3" />
              Open
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {filteredByMonthBookings.some((b: any) => !b.saleMonthKey && !b.bookingMonthKey) && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-200 font-medium">
                    Обнаружены старые данные. Для корректной фильтрации по месяцам рекомендуется повторно загрузить Excel файл.
                  </p>
                </div>
              )}

              {/* Monthly Cycle Wizard Card */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] p-8 flex items-center justify-between group hover:bg-indigo-500/15 transition-all mb-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                    <History className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">Месячный цикл</h3>
                    <p className="text-indigo-200/60 text-sm max-w-md">
                      Запустите мастер настройки для проверки участников, планов и загрузки данных за выбранный период.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowWizard(true)}
                  className="bg-white text-indigo-950 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-50 transition-all active:scale-95 shadow-xl"
                >
                  Запустить мастер
                </button>
              </div>

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Общая выручка ({selectedMonth})</div>
                  <div className="text-4xl font-black text-white tracking-tighter">
                    {stats.net.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="mt-4 flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                      <TrendingUp className="w-4 h-4" />
                      Всего {filteredByMonthBookings.length} бронирований
                    </div>
                    <div className="text-slate-500 text-[10px] font-bold">
                      Сумма отмен: {stats.cancelled.toLocaleString('ru-RU')} ₽ ({stats.cancelRate.toFixed(1)}%)
                    </div>
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Через продавцов</div>
                  <div className="text-4xl font-black text-emerald-400 tracking-tighter">
                    {stats.sellerRevenue.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-bold">
                    {((stats.sellerRevenue / (stats.net || 1)) * 100).toFixed(1)}% от общей
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Без продавцов</div>
                  <div className="text-4xl font-black text-blue-400 tracking-tighter">
                    {stats.nonSellerRevenue.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-bold">
                    {((stats.nonSellerRevenue / (stats.net || 1)) * 100).toFixed(1)}% от общей
                  </div>
                </div>
              </div>

              {/* Non-Seller Breakdown */}
              {stats.nonSellerRevenue > 0 && (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-blue-400" />
                      <h3 className="text-xl font-bold text-white">Без продавцов (по источникам)</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {Object.entries(stats.nonSellerBySource).map(([source, amount]) => (
                      <div key={source} className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1 truncate">{source}</div>
                        <div className="text-lg font-bold text-white">{amount.toLocaleString('ru-RU')} ₽</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Sources / Sellers */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Эффективность</h3>
                  <div className="flex bg-black/20 rounded-xl p-1">
                    {(['week', 'month', 'year'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setEfficiencyPeriod(p)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                          efficiencyPeriod === p ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  {efficiencyBookings.length > 0 ? (
                    <div className="space-y-4">
                      {efficiencyBookings.slice(0, 5).map(booking => (
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
                            <div className="text-[10px] text-slate-500">{prettyDate(booking.saleDateIso || (booking as any).saleDate)}</div>
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

          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-12 text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckSquare className="w-10 h-10 text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">Управление задачами</h2>
                  <p className="text-slate-400 max-w-md mx-auto">
                    Используйте Канбан-доску для отслеживания прогресса, назначения ответственных и контроля сроков.
                  </p>
                </div>
                <button 
                  onClick={() => navigate(`/projects/${id}/tasks`)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  Открыть Канбан-доску
                </button>
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
                  {monthConfig?.status === 'locked' && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                      <Lock className="w-4 h-4" />
                      Месяц заблокирован
                    </div>
                  )}
                </div>
                
                {monthConfig?.status === 'locked' && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 mb-6">
                    <Lock className="w-5 h-5 text-red-400 shrink-0" />
                    <p className="text-sm text-red-200 font-medium">
                      Загрузка новых данных невозможна, так как месяц заблокирован.
                    </p>
                  </div>
                )}

                <div className={cn(monthConfig?.status === 'locked' && "opacity-50 pointer-events-none")}>
                  <ProjectUpload 
                    projectId={id!} 
                    actorRole={getParticipantRole(user?.uid)}
                    onSuccess={() => {}} 
                  />
                </div>
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
                          <div className="text-[10px] text-slate-500">{prettyDate(booking.checkInIso || (booking as any).checkIn)}</div>
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
                                {getParticipantRole(plan.uid)}
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
                  Автоматический расчет V2
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {personalPlans.length > 0 ? (
                  calculateCommissions(
                    filteredByMonthBookings,
                    personalPlans,
                    companyPlan,
                    projectParticipants,
                    stats.net
                  ).map(res => {
                    const participant = projectParticipants.find(p => p.uid === res.uid);
                    
                    return (
                      <div key={res.uid} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
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
                                Выполнение: {res.achievement.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                            <div>
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Net Продажи</div>
                              <div className="text-lg font-bold text-white">{res.netSales.toLocaleString('ru-RU')} ₽</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Ставка</div>
                              <div className="text-lg font-bold text-emerald-400">{(res.baseRate * 100).toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Штраф</div>
                              <div className="text-lg font-bold text-red-400">{(res.penaltyRate * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Бонус</div>
                              <div className="text-lg font-bold text-blue-400">{(res.bonusRate * 100).toFixed(0)}%</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">К выплате</div>
                              <div className="text-xl font-black text-white">{res.amount.toLocaleString('ru-RU')} ₽</div>
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

                {canManage && personalPlans.length > 0 && (
                  <div className="flex justify-end gap-4 mt-8">
                    <button 
                      onClick={() => setShowSnapshotModal(true)}
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl font-bold text-sm border border-white/10 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      Создать снапшот
                    </button>
                    {monthConfig?.status === 'locked' ? (
                      <button 
                        onClick={() => setShowUnlockModal(true)}
                        className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3 rounded-2xl font-bold text-sm border border-red-500/20 transition-all"
                      >
                        <Unlock className="w-4 h-4" />
                        Разблокировать месяц
                      </button>
                    ) : (
                      <button 
                        onClick={handleLock}
                        disabled={isLocking}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                      >
                        <Lock className="w-4 h-4" />
                        {isLocking ? 'Блокировка...' : 'Утвердить выплаты и заблокировать'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'snapshots' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight">Версии расчетов</h2>
                <button 
                  onClick={() => setShowSnapshotModal(true)}
                  className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
                >
                  <Camera className="w-4 h-4" />
                  Новая версия
                </button>
              </div>

              <div className="space-y-4">
                {snapshots.length > 0 ? (
                  snapshots.map(snap => (
                    <div key={snap.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white font-bold border border-white/10">
                            v{snap.version}
                          </div>
                          <div>
                            <div className="text-lg font-bold text-white">
                              {snap.note || `Версия ${snap.version}`}
                            </div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                              {prettyDate(snap.createdAt?.toDate?.()?.toISOString() || snap.createdAt)} • {snap.authorUid}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRollback(snap)}
                          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold border border-white/10 transition-all"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Откатиться
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-12 text-center">
                    <History className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 italic">Снапшотов пока нет</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">Журнал аудита</h2>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Действие</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Исполнитель</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Дата</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Детали</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-white truncate max-w-[100px]">{log.actor_uid}</div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{log.actor_role}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {prettyDate(log.created_at?.toDate?.()?.toISOString() || log.created_at)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-mono truncate max-w-xs">
                            {log.after_json || log.before_json || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                : stats.net >= (companyPlan?.target || 0) * 0.8
                ? "Почти у цели! Еще немного усилий и бонус ваш!"
                : stats.net >= (companyPlan?.target || 0) * 0.5
                ? "Половина пути пройдена. Темп хороший!"
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
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">Настройки проекта</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">Основное</h4>
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
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all h-32 resize-none"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  Сохранить изменения
                </button>
              </form>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">Участники</h4>
                  <button 
                    onClick={() => setShowUserSearch(true)}
                    className="text-[10px] font-black text-white/50 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Добавить
                  </button>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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

                {isOwner && (
                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <h4 className="text-xs font-black text-red-400 uppercase tracking-[0.2em]">Опасная зона</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => setShowCleanupModal('month')}
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-bold text-sm transition-all"
                      >
                        Очистить данные за {selectedMonth}
                      </button>
                      <button 
                        onClick={() => setShowCleanupModal('all')}
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-bold text-sm transition-all"
                      >
                        Очистить ВСЕ данные проекта
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Modal */}
      {showSnapshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">Создать снапшот</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Заметка</label>
                <textarea 
                  value={snapshotNote}
                  onChange={(e) => setSnapshotNote(e.target.value)}
                  placeholder="Например: Финальный расчет перед выплатой"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all min-h-[100px]"
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowSnapshotModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-bold text-sm transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleCreateSnapshot}
                  disabled={isSnapshotting}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {isSnapshotting ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">Разблокировать месяц</h3>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-4">
                <p className="text-xs text-red-400 font-medium">
                  Разблокировка месяца позволяет изменять данные. Это действие будет записано в журнал аудита.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Причина разблокировки</label>
                <textarea 
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Укажите причину..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all min-h-[100px]"
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowUnlockModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-bold text-sm transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleUnlock}
                  disabled={isLocking || !unlockReason}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {isLocking ? 'Разблокировка...' : 'Разблокировать'}
                </button>
              </div>
            </div>
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

      {/* Monthly Cycle Wizard */}
      {project && (
        <MonthlyCycleWizard 
          projectId={id!}
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          project={project}
          participants={projectParticipants}
          actorRole={getParticipantRole(user?.uid)}
        />
      )}

      {/* Cleanup Confirmation Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-red-500/20 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6 text-red-500">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Внимание!</h3>
            </div>
            
            <p className="text-slate-300 mb-6 leading-relaxed">
              {showCleanupModal === 'month' 
                ? `Вы собираетесь удалить все бронирования и расчеты за ${selectedMonth}. Это действие необратимо.`
                : "Вы собираетесь удалить ВСЕ данные проекта (бронирования, планы, комиссии, штрафы). Это действие необратимо."}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Введите "ОЧИСТИТЬ" для подтверждения
                </label>
                <input 
                  value={cleanupConfirmText}
                  onChange={(e) => setCleanupConfirmText(e.target.value)}
                  placeholder="ОЧИСТИТЬ"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all uppercase"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => {
                    setShowCleanupModal(null);
                    setCleanupConfirmText("");
                  }}
                  disabled={isCleaning}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleCleanup}
                  disabled={isCleaning || cleanupConfirmText !== "ОЧИСТИТЬ"}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:grayscale"
                >
                  {isCleaning ? "Удаление..." : "Удалить"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
