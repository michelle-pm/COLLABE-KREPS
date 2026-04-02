import React, { useState, useEffect } from "react";
import { 
  X, 
  Users, 
  Target, 
  FileUp, 
  Calculator, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  History
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  Timestamp,
  setDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { useAuth } from "./FirebaseProvider";
import { Project, ProjectParticipant, Plan, Booking, UserProfile, MonthConfig } from "../types";
import { ProjectUpload } from "./ProjectUpload";
import { calculateCommissions } from "../services/commissionService";
import { lockMonth, getMonthConfig } from "../services/monthService";
import { cn } from "../lib/utils";
import { toast } from "sonner";

interface MonthlyCycleWizardProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  participants: ProjectParticipant[];
  actorRole: string;
}

export function MonthlyCycleWizard({ projectId, isOpen, onClose, project, participants, actorRole }: MonthlyCycleWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  
  // Step 2: Plans
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({ target: "", type: 'personal' as 'company' | 'personal', uid: "" });

  // Step 4: Commissions
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [monthConfig, setMonthConfig] = useState<MonthConfig | null>(null);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    
    // Reset wizard when opened
    setStep(1);
    
    // Fetch initial data for the selected month
    fetchMonthData();
  }, [isOpen, projectId, selectedMonth]);

  const fetchMonthData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Fetch plans for this month
      const plansQuery = query(
        collection(db, `projects/${projectId}/plans`),
        where("startDate", ">=", `${selectedMonth}-01`),
        where("startDate", "<=", `${selectedMonth}-31`)
      );
      const plansSnap = await getDocs(plansQuery);
      setPlans(plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Plan)));

      // Fetch bookings for this month
      const bookingsQuery = query(
        collection(db, `projects/${projectId}/bookings`),
        where("saleMonthKey", "==", selectedMonth)
      );
      const bookingsSnap = await getDocs(bookingsQuery);
      setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));

      // Fetch month config
      const config = await getMonthConfig(projectId, selectedMonth);
      setMonthConfig(config);
    } catch (error) {
      console.error("Error fetching month data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlan = async () => {
    if (!newPlan.target || !projectId || !user) return;
    try {
      const startOfMonth = new Date(`${selectedMonth}-01`);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      
      await addDoc(collection(db, `projects/${projectId}/plans`), {
        projectId,
        uid: newPlan.type === 'personal' ? (newPlan.uid || user.uid) : null,
        type: newPlan.type,
        target: Number(newPlan.target),
        actual: 0,
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
        period: 'month',
        updatedAt: serverTimestamp()
      });
      
      toast.success("План добавлен");
      setShowPlanForm(false);
      setNewPlan({ target: "", type: 'personal', uid: "" });
      fetchMonthData();
    } catch (error) {
      toast.error("Ошибка при добавлении плана");
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!window.confirm("Удалить этот план?")) return;
    try {
      await deleteDoc(doc(db, `projects/${projectId}/plans`, planId));
      toast.success("План удален");
      fetchMonthData();
    } catch (error) {
      toast.error("Ошибка при удалении плана");
    }
  };

  const handleLockMonth = async () => {
    if (!projectId || !user) return;
    if (!window.confirm("Вы уверены, что хотите заблокировать месяц? Это действие зафиксирует расчеты.")) return;
    
    setLoading(true);
    try {
      await lockMonth(projectId, selectedMonth, user.uid, actorRole);
      toast.success("Месяц заблокирован");
      fetchMonthData();
      onClose();
    } catch (error) {
      toast.error("Ошибка при блокировке месяца");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const steps = [
    { id: 1, title: "Справочники", icon: Users, description: "Проверка участников и ролей" },
    { id: 2, title: "Планы", icon: Target, description: "Установка целей на месяц" },
    { id: 3, title: "Загрузка", icon: FileUp, description: "Импорт данных из Excel" },
    { id: 4, title: "Расчет", icon: Calculator, description: "Проверка комиссий и фиксация" }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-white/10 rounded-[3rem] w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">Месячный цикл</h2>
              <div className="flex items-center gap-2">
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-indigo-400 font-bold text-sm focus:outline-none cursor-pointer"
                />
                {monthConfig?.status === 'locked' && (
                  <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-red-500/20">
                    <Lock className="w-3 h-3" />
                    Заблокировано
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Steps */}
          <div className="w-72 border-r border-white/5 p-6 space-y-2 bg-slate-950/30">
            {steps.map((s) => (
              <div 
                key={s.id}
                className={cn(
                  "p-4 rounded-2xl transition-all duration-300 flex items-center gap-4 border",
                  step === s.id 
                    ? "bg-indigo-500/10 border-indigo-500/30 text-white" 
                    : step > s.id 
                    ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400"
                    : "bg-transparent border-transparent text-slate-500"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  step === s.id ? "bg-indigo-500 text-white" : step > s.id ? "bg-emerald-500 text-white" : "bg-white/5"
                )}>
                  {step > s.id ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-widest">{s.title}</div>
                  <div className="text-[10px] opacity-60 truncate">{s.description}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">Участники и роли</h3>
                  <p className="text-slate-400">Проверьте состав команды на этот месяц. Убедитесь, что у всех правильные роли для расчета комиссий.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {participants.map((p) => (
                    <div key={p.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-white/5">
                          {p.uid[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{p.uid}</div>
                          <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{p.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg font-black uppercase tracking-widest">Активен</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6 flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-indigo-400 shrink-0 mt-1" />
                  <div className="text-sm text-indigo-200/70 leading-relaxed">
                    Роль <span className="text-white font-bold uppercase tracking-widest">seller</span> влияет на расчет личных планов и бонусов. 
                    Роль <span className="text-white font-bold uppercase tracking-widest">manager</span> дает доступ к управлению проектом.
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">Планы на месяц</h3>
                    <p className="text-slate-400">Установите финансовые цели для компании и отдельных сотрудников.</p>
                  </div>
                  <button 
                    onClick={() => setShowPlanForm(true)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                  >
                    <Plus className="w-4 h-4 mr-2 inline" />
                    Добавить план
                  </button>
                </div>

                {showPlanForm && (
                  <div className="bg-white/5 border border-indigo-500/30 rounded-[2rem] p-8 space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Тип плана</label>
                        <select 
                          value={newPlan.type}
                          onChange={(e) => setNewPlan(prev => ({ ...prev, type: e.target.value as any }))}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        >
                          <option value="personal">Личный</option>
                          <option value="company">Общий (компания)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Цель (₽)</label>
                        <input 
                          type="number"
                          value={newPlan.target}
                          onChange={(e) => setNewPlan(prev => ({ ...prev, target: e.target.value }))}
                          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                          placeholder="0.00"
                        />
                      </div>
                      {newPlan.type === 'personal' && (
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Сотрудник</label>
                          <select 
                            value={newPlan.uid}
                            onChange={(e) => setNewPlan(prev => ({ ...prev, uid: e.target.value }))}
                            className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                          >
                            <option value="">Выберите сотрудника...</option>
                            {participants.filter(p => p.role === 'seller').map(p => (
                              <option key={p.uid} value={p.uid}>{p.uid}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowPlanForm(false)}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs transition-all"
                      >
                        Отмена
                      </button>
                      <button 
                        onClick={handleAddPlan}
                        className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20"
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {plans.length > 0 ? (
                    plans.map((plan) => (
                      <div key={plan.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center font-bold border",
                            plan.type === 'company' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          )}>
                            {plan.type === 'company' ? <Target className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              {plan.type === 'company' ? "Общий план компании" : `Личный план: ${plan.uid}`}
                            </div>
                            <div className="text-lg font-black text-indigo-400 italic">
                              {plan.target.toLocaleString('ru-RU')} ₽
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-3 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white/5 border border-dashed border-white/10 rounded-3xl text-slate-500 italic">
                      Планы на этот месяц еще не установлены.
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">Загрузка данных</h3>
                  <p className="text-slate-400">Загрузите отчеты из Excel для автоматического расчета комиссий.</p>
                </div>

                <ProjectUpload 
                  projectId={projectId} 
                  actorRole={actorRole} 
                  onSuccess={() => fetchMonthData()} 
                />
                
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Загружено бронирований</div>
                      <div className="text-xs text-slate-500 uppercase tracking-widest font-black">За {selectedMonth}</div>
                    </div>
                  </div>
                  <div className="text-3xl font-black text-emerald-400 italic">{bookings.length}</div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">Проверка и фиксация</h3>
                  <p className="text-slate-400">Финальный этап. Проверьте расчеты и заблокируйте месяц для предотвращения изменений.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-4">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Общая выручка (Net)</div>
                    <div className="text-4xl font-black text-white italic">
                      {bookings.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + b.total, 0).toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      {bookings.length} бронирований учтено
                    </div>
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-8 space-y-4">
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Выполнение плана</div>
                    <div className="text-4xl font-black text-white italic">
                      {plans.find(p => p.type === 'company') 
                        ? ((bookings.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + b.total, 0) / (plans.find(p => p.type === 'company')?.target || 1)) * 100).toFixed(1)
                        : "0"}%
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (bookings.filter(b => b.status !== 'cancelled').reduce((sum, b) => sum + b.total, 0) / (plans.find(p => p.type === 'company')?.target || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
                      <Lock className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">Блокировка периода</h4>
                      <p className="text-sm text-slate-500">После блокировки любые изменения данных за этот месяц будут невозможны без специального разрешения.</p>
                    </div>
                  </div>
                  
                  {monthConfig?.status === 'locked' ? (
                    <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-red-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      Месяц уже заблокирован
                    </div>
                  ) : (
                    <button 
                      onClick={handleLockMonth}
                      disabled={loading}
                      className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50"
                    >
                      {loading ? "Блокировка..." : "Заблокировать месяц"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 flex items-center justify-between bg-white/5">
          <button 
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </button>
          
          <div className="flex items-center gap-2">
            {steps.map(s => (
              <div 
                key={s.id} 
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  step === s.id ? "w-8 bg-indigo-500" : step > s.id ? "bg-emerald-500" : "bg-white/10"
                )} 
              />
            ))}
          </div>

          <button 
            onClick={() => {
              if (step < 4) setStep(prev => prev + 1);
              else onClose();
            }}
            className="flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95"
          >
            {step === 4 ? "Завершить" : "Далее"}
            {step < 4 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
