import React, { useState } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc, 
  serverTimestamp,
  arrayUnion,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Shield, RefreshCw, CheckCircle2, AlertCircle, History, User, Briefcase, Clock } from "lucide-react";
import { toast } from "sonner";
import { AuditLog } from "../types";
import { cn } from "../lib/utils";

export function Admin() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  React.useEffect(() => {
    if (profile?.role === 'admin') {
      fetchLogs();
    }
  }, [profile]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const logsSnap = await getDocs(query(collection(db, "audit_logs"), orderBy("created_at", "desc"), limit(50)));
      setLogs(logsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AuditLog)));
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="text-slate-500 text-xl font-bold tracking-widest uppercase">Доступ запрещен</div>
      </div>
    );
  }

  const runMigration = async () => {
    setLoading(true);
    setResults(null);
    let success = 0;
    let failed = 0;

    try {
      const projectsSnap = await getDocs(collection(db, "projects"));
      
      for (const projectDoc of projectsSnap.docs) {
        try {
          const data = projectDoc.data();
          const ownerUid = data.owner_uid;
          const participantUids = data.participant_uids || [];

          // 1. Ensure owner is in participant_uids
          if (!participantUids.includes(ownerUid)) {
            await updateDoc(doc(db, "projects", projectDoc.id), {
              participant_uids: arrayUnion(ownerUid)
            });
          }

          // 2. Ensure owner has entry in participants subcollection
          const ownerParticipantRef = doc(db, "projects", projectDoc.id, "participants", ownerUid);
          await setDoc(ownerParticipantRef, {
            uid: ownerUid,
            role: 'owner',
            active: true,
            joinedAt: data.createdAt || serverTimestamp()
          }, { merge: true });

          success++;
        } catch (e) {
          console.error(`Error migrating project ${projectDoc.id}:`, e);
          failed++;
        }
      }
      setResults({ success, failed });
      toast.success("Миграция завершена");
    } catch (error) {
      console.error("Migration error:", error);
      handleFirestoreError(error, OperationType.LIST, "projects");
      toast.error("Ошибка при выполнении миграции");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        <Shield className="w-10 h-10 text-indigo-500" />
        <h1 className="text-4xl font-bold text-white tracking-tight">Панель администратора</h1>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Миграция данных</h2>
          <p className="text-slate-400">
            Этот инструмент проверит все проекты и убедится, что:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Владелец проекта добавлен в список участников (participant_uids).</li>
              <li>Владелец имеет запись в подколлекции участников с ролью 'owner'.</li>
            </ul>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={runMigration}
            disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Выполняется..." : "Запустить миграцию"}
          </button>
        </div>

        {results && (
          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-500">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <div>
                <div className="text-2xl font-bold text-white">{results.success}</div>
                <div className="text-xs text-emerald-500 uppercase font-black tracking-widest">Успешно</div>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold text-white">{results.failed}</div>
                <div className="text-xs text-red-500 uppercase font-black tracking-widest">Ошибок</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Журнал аудита</h2>
            <p className="text-slate-400">Последние 50 критических действий в системе.</p>
          </div>
          <button 
            onClick={fetchLogs}
            disabled={loadingLogs}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            <RefreshCw className={cn("w-5 h-5 text-indigo-400", loadingLogs && "animate-spin")} />
          </button>
        </div>

        <div className="space-y-3">
          {loadingLogs ? (
            [1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />)
          ) : logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                    <History className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white uppercase tracking-wider">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-lg font-black uppercase tracking-widest border border-indigo-500/20">
                        {log.actor_role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.actor_uid}
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {log.project_id}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.created_at?.toDate().toLocaleString('ru-RU')}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Entity</div>
                  <div className="text-xs text-slate-400 font-mono">{log.entity || '-'}:{log.entity_id || '-'}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-500 italic">Логов пока нет.</div>
          )}
        </div>
      </div>
    </div>
  );
}
