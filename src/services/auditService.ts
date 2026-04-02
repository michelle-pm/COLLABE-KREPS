import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { AuditLog } from "../types";

export async function logAction(params: {
  action: string;
  actor_uid: string;
  actor_role: string;
  project_id: string;
  month_key?: string | null;
  entity?: string;
  entity_id?: string;
  before_json?: any;
  after_json?: any;
}) {
  const log: Omit<AuditLog, 'id'> = {
    action: params.action,
    actor_uid: params.actor_uid,
    actor_role: params.actor_role,
    project_id: params.project_id,
    month_key: params.month_key || null,
    entity: params.entity || undefined,
    entity_id: params.entity_id || undefined,
    before_json: params.before_json ? JSON.stringify(params.before_json) : null,
    after_json: params.after_json ? JSON.stringify(params.after_json) : null,
    created_at: serverTimestamp(),
  };

  try {
    await addDoc(collection(db, "audit_logs"), log);
  } catch (error) {
    console.error("Failed to log action:", error);
  }
}
