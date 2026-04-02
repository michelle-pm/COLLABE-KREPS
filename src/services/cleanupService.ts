import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { AuditLog } from "../types";

import { logAction } from "./auditService";

async function batchDelete(collectionPath: string, q: any) {
  const snapshot = await getDocs(q);
  let count = 0;
  
  // Firestore batch limit is 500
  const chunks = [];
  for (let i = 0; i < snapshot.docs.length; i += 500) {
    chunks.push(snapshot.docs.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      batch.delete(d.ref);
      count++;
    });
    await batch.commit();
  }
  
  return count;
}

export async function clearMonthData(
  projectId: string, 
  monthKey: string, 
  executedBy: string,
  actorRole: string
) {
  const bookingsRef = collection(db, `projects/${projectId}/bookings`);
  const q = query(bookingsRef, where("saleMonthKey", "==", monthKey));
  const deletedBookings = await batchDelete(`projects/${projectId}/bookings`, q);

  const commissionsRef = collection(db, `projects/${projectId}/commissions`);
  const qComm = query(commissionsRef, where("month", "==", monthKey));
  const deletedCommissions = await batchDelete(`projects/${projectId}/commissions`, qComm);

  // Audit log
  await logAction({
    action: 'clear_month',
    actor_uid: executedBy,
    actor_role: actorRole,
    project_id: projectId,
    month_key: monthKey,
    after_json: {
      deletedBookings,
      deletedCommissions
    }
  });

  return { deletedBookings, deletedCommissions };
}

export async function clearAllProjectData(
  projectId: string, 
  executedBy: string,
  actorRole: string
) {
  const collections = [
    "bookings",
    "uploads",
    "commissions",
    "reviews",
    "penalties",
    "plans"
  ];

  const affectedCounts: any = {};

  for (const coll of collections) {
    const ref = collection(db, `projects/${projectId}/${coll}`);
    const snapshot = await getDocs(ref);
    
    let count = 0;
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 500) {
      chunks.push(snapshot.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.delete(d.ref);
        count++;
      });
      await batch.commit();
    }
    affectedCounts[coll] = count;
  }

  // Audit log
  await logAction({
    action: 'clear_all',
    actor_uid: executedBy,
    actor_role: actorRole,
    project_id: projectId,
    after_json: affectedCounts
  });

  return affectedCounts;
}
