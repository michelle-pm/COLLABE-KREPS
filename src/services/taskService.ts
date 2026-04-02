import { db } from "../firebase";
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  getDocs
} from "firebase/firestore";
import { 
  TaskBoard, 
  TaskColumn, 
  TaskItem
} from "../types";

import { logAction } from "./auditService";

export const taskService = {
  // Boards
  async listBoards(projectId: string) {
    const q = query(collection(db, `projects/${projectId}/task_boards`), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskBoard));
  },

  async createBoard(projectId: string, name: string, isDefault: boolean, userId: string, actorRole: string) {
    const boardData = {
      projectId,
      name,
      isDefault,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, `projects/${projectId}/task_boards`), boardData);
    
    await logAction({
      action: 'create_board',
      actor_uid: userId,
      actor_role: actorRole,
      project_id: projectId,
      entity: 'task_board',
      entity_id: docRef.id,
      after_json: boardData
    });

    return docRef;
  },

  // Columns
  async listColumns(projectId: string, boardId: string) {
    const q = query(
      collection(db, `projects/${projectId}/task_columns`), 
      where("boardId", "==", boardId),
      orderBy("order", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskColumn));
  },

  async createColumn(projectId: string, boardId: string, title: string, order: number, userId: string, actorRole: string) {
    const columnData = {
      boardId,
      projectId,
      title,
      order,
      wipLimit: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, `projects/${projectId}/task_columns`), columnData);

    await logAction({
      action: 'create_column',
      actor_uid: userId,
      actor_role: actorRole,
      project_id: projectId,
      entity: 'task_column',
      entity_id: docRef.id,
      after_json: columnData
    });

    return docRef;
  },

  // Tasks
  async createTask(projectId: string, task: Partial<TaskItem>, userId: string, actorRole: string) {
    const taskData = {
      ...task,
      projectId,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, `projects/${projectId}/tasks`), taskData);

    await logAction({
      action: 'create_task',
      actor_uid: userId,
      actor_role: actorRole,
      project_id: projectId,
      entity: 'task',
      entity_id: docRef.id,
      after_json: taskData
    });

    return docRef;
  },

  async updateTask(projectId: string, taskId: string, updates: Partial<TaskItem>, userId: string, actorRole: string) {
    const taskRef = doc(db, `projects/${projectId}/tasks`, taskId);
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    await logAction({
      action: 'update_task',
      actor_uid: userId,
      actor_role: actorRole,
      project_id: projectId,
      entity: 'task',
      entity_id: taskId,
      after_json: updates
    });
  },

  async moveTask(projectId: string, taskId: string, columnId: string, status: string, order: number, userId: string, actorRole: string) {
    return this.updateTask(projectId, taskId, { columnId, status, order }, userId, actorRole);
  },

  async archiveTask(projectId: string, taskId: string, userId: string, actorRole: string) {
    return this.updateTask(projectId, taskId, { archived: true }, userId, actorRole);
  },

  // Comments
  async addTaskComment(projectId: string, taskId: string, authorUid: string, text: string) {
    const commentData = {
      projectId,
      taskId,
      authorUid,
      text,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    return addDoc(collection(db, `projects/${projectId}/task_comments`), commentData);
  },

  // Activity
  async logTaskActivity(projectId: string, taskId: string, actorUid: string, actionType: string, payload: any) {
    const activityData = {
      projectId,
      taskId,
      actorUid,
      actionType,
      payload,
      createdAt: serverTimestamp()
    };
    return addDoc(collection(db, `projects/${projectId}/task_activity`), activityData);
  },

  // Initialization
  async initializeProjectTasks(projectId: string, userId: string, actorRole: string) {
    const boards = await this.listBoards(projectId);
    if (boards.length > 0) return;

    // Create default board
    const boardRef = await this.createBoard(projectId, "Основная доска", true, userId, actorRole);
    const boardId = boardRef.id;

    // Create default columns
    const columns = [
      "Backlog",
      "To Do",
      "In Progress",
      "Review",
      "Done",
      "Blocked"
    ];

    for (let i = 0; i < columns.length; i++) {
      await this.createColumn(projectId, boardId, columns[i], i, userId, actorRole);
    }
  }
};
