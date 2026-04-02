import { db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { MonthConfig } from "../types";
import { logAction } from "./auditService";

export async function getMonthConfig(projectId: string, monthKey: string): Promise<MonthConfig | null> {
  const docRef = doc(db, `projects/${projectId}/month_configs`, monthKey);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as MonthConfig;
  }
  return null;
}

export async function lockMonth(projectId: string, monthKey: string, uid: string, role: string) {
  const docRef = doc(db, `projects/${projectId}/month_configs`, monthKey);
  const config: Omit<MonthConfig, 'id'> = {
    projectId,
    status: 'locked',
    lockedAt: serverTimestamp(),
    lockedBy: uid,
    updatedAt: serverTimestamp()
  };
  await setDoc(docRef, config);
  
  await logAction({
    action: 'lock_month',
    actor_uid: uid,
    actor_role: role,
    project_id: projectId,
    month_key: monthKey,
    entity: 'month_config',
    entity_id: monthKey,
    after_json: config
  });
}

export async function unlockMonth(projectId: string, monthKey: string, uid: string, role: string, reason: string) {
  const docRef = doc(db, `projects/${projectId}/month_configs`, monthKey);
  const before = await getMonthConfig(projectId, monthKey);
  
  await updateDoc(docRef, {
    status: 'open',
    unlockReason: reason,
    updatedAt: serverTimestamp()
  });

  await logAction({
    action: 'unlock_month',
    actor_uid: uid,
    actor_role: role,
    project_id: projectId,
    month_key: monthKey,
    entity: 'month_config',
    entity_id: monthKey,
    before_json: before,
    after_json: { status: 'open', unlockReason: reason }
  });
}
