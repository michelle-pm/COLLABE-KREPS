import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc, arrayUnion, setDoc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

export async function migrateProjectsData() {
  console.log("Starting projects migration...");
  try {
    const projectsRef = collection(db, "projects");
    const snapshot = await getDocs(projectsRef);
    
    let updatedCount = 0;
    
    for (const projectDoc of snapshot.docs) {
      const data = projectDoc.data();
      const ownerUid = data.owner_uid;
      let participantUids = data.participant_uids;
      
      let needsUpdate = false;
      const updateData: any = {};
      
      // Ensure participant_uids exists as an array
      if (!Array.isArray(participantUids)) {
        participantUids = ownerUid ? [ownerUid] : [];
        updateData.participant_uids = participantUids;
        needsUpdate = true;
      }
      
      // Ensure owner_uid is in participant_uids
      if (ownerUid && !participantUids.includes(ownerUid)) {
        updateData.participant_uids = arrayUnion(ownerUid);
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await updateDoc(doc(db, "projects", projectDoc.id), updateData);
        updatedCount++;
      }

      // Ensure owner is in participants subcollection with 'owner' role
      if (ownerUid) {
        const participantDocRef = doc(db, "projects", projectDoc.id, "participants", ownerUid);
        const participantDoc = await getDoc(participantDocRef);
        if (!participantDoc.exists()) {
          await setDoc(participantDocRef, {
            uid: ownerUid,
            role: 'owner',
            active: true,
            commissionBaseRate: 0.03,
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      }

      // Ensure all other participant_uids have a role in the subcollection
      if (Array.isArray(participantUids)) {
        for (const uid of participantUids) {
          if (uid === ownerUid) continue;
          const pRef = doc(db, "projects", projectDoc.id, "participants", uid);
          const pDoc = await getDoc(pRef);
          if (!pDoc.exists()) {
            await setDoc(pRef, {
              uid: uid,
              role: 'seller',
              active: true,
              commissionBaseRate: 0.03,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }
    
    console.log(`Migration completed. Updated ${updatedCount} projects.`);
    toast.success(`Миграция завершена. Обновлено проектов: ${updatedCount}`);
    return updatedCount;
  } catch (error) {
    console.error("Migration failed:", error);
    toast.error("Ошибка миграции данных");
    throw error;
  }
}
