import React, { useState } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc, 
  serverTimestamp,
  arrayUnion
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Shield, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function Admin() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

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
    </div>
  );
}
