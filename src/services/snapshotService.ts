import { db } from "../firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  limit, 
  doc, 
  writeBatch 
} from "firebase/firestore";
import { CalculationSnapshot, Commission } from "../types";
import { logAction } from "./auditService";

export async function createSnapshot(
  projectId: string, 
  monthKey: string, 
  uid: string, 
  role: string, 
  note: string,
  commissions: Commission[],
  stats: any
) {
  // Get current version
  const snapshotsRef = collection(db, `projects/${projectId}/snapshots`);
  const q = query(snapshotsRef, where("monthKey", "==", monthKey), orderBy("version", "desc"), limit(1));
  const snap = await getDocs(q);
  let version = 1;
  if (!snap.empty) {
    version = snap.docs[0].data().version + 1;
  }

  const snapshot: Omit<CalculationSnapshot, 'id'> = {
    projectId,
    monthKey,
    version,
    note,
    authorUid: uid,
    createdAt: serverTimestamp(),
    data: {
      commissions,
      stats
    }
  };

  const docRef = await addDoc(snapshotsRef, snapshot);

  await logAction({
    action: 'create_snapshot',
    actor_uid: uid,
    actor_role: role,
    project_id: projectId,
    month_key: monthKey,
    entity: 'snapshot',
    entity_id: docRef.id,
    after_json: { version, note }
  });

  return docRef.id;
}

export async function getSnapshots(projectId: string, monthKey: string) {
  const snapshotsRef = collection(db, `projects/${projectId}/snapshots`);
  const q = query(snapshotsRef, where("monthKey", "==", monthKey), orderBy("version", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CalculationSnapshot));
}

export async function rollbackToSnapshot(
  projectId: string,
  snapshot: CalculationSnapshot,
  uid: string,
  role: string
) {
  const batch = writeBatch(db);
  
  // Restore commissions
  snapshot.data.commissions.forEach(comm => {
    const commRef = doc(db, `projects/${projectId}/commissions`, comm.id);
    batch.set(commRef, { ...comm, updatedAt: serverTimestamp() });
  });

  await batch.commit();

  await logAction({
    action: 'rollback_snapshot',
    actor_uid: uid,
    actor_role: role,
    project_id: projectId,
    month_key: snapshot.monthKey,
    entity: 'snapshot',
    entity_id: snapshot.id,
    after_json: { version: snapshot.version }
  });
}
