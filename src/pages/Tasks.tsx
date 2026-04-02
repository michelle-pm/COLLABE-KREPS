import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  LayoutGrid, 
  List, 
  User, 
  Plus, 
  Search, 
  Filter, 
  CheckSquare, 
  Clock, 
  AlertCircle,
  MoreVertical,
  ChevronRight,
  Calendar,
  Tag,
  MessageSquare,
  History,
  Lock,
  Unlock,
  Archive,
  Trash2
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  Timestamp
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { 
  Project, 
  TaskBoard, 
  TaskColumn, 
  TaskItem, 
  ProjectParticipant,
  UserRole
} from "../types";
import { taskService } from "../services/taskService";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { KanbanBoard } from "../components/tasks/KanbanBoard";
import { TaskModal } from "../components/tasks/TaskModal";

export function Tasks() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [participant, setParticipant] = useState<ProjectParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'kanban' | 'list' | 'my-tasks'>('kanban');
  
  const [boards, setBoards] = useState<TaskBoard[]>([]);
  const [columns, setColumns] = useState<TaskColumn[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch project and participant info
  useEffect(() => {
    if (!id || !user) return;

    const fetchProject = async () => {
      try {
        const projectDoc = await getDoc(doc(db, "projects", id));
        if (!projectDoc.exists()) {
          toast.error("Проект не найден");
          navigate("/projects");
          return;
        }
        setProject({ id: projectDoc.id, ...projectDoc.data() } as Project);

        // Check participant
        const partDoc = await getDoc(doc(db, `projects/${id}/participants`, user.uid));
        if (partDoc.exists()) {
          setParticipant({ id: partDoc.id, ...partDoc.data() } as ProjectParticipant);
        } else {
          // Fallback for old projects or if participant subcollection is missing
          const projectData = projectDoc.data() as Project;
          if (projectData.owner_uid === user.uid) {
            setParticipant({ 
              id: user.uid, 
              uid: user.uid, 
              role: 'owner', 
              active: true, 
              commissionBaseRate: 0 
            } as ProjectParticipant);
          } else if (projectData.participant_uids.includes(user.uid)) {
            setParticipant({ 
              id: user.uid, 
              uid: user.uid, 
              role: 'seller', 
              active: true, 
              commissionBaseRate: 0 
            } as ProjectParticipant);
          } else {
            toast.error("У вас нет доступа к этому проекту");
            navigate("/projects");
          }
        }
      } catch (error) {
        console.error("Error fetching project:", error);
        toast.error("Ошибка при загрузке проекта");
      }
    };

    fetchProject();
  }, [id, user, navigate]);

  // Initialize tasks if needed
  useEffect(() => {
    if (!id || !user || !participant) return;

    const init = async () => {
      setIsInitializing(true);
      try {
        await taskService.initializeProjectTasks(id, user.uid, participant.role);
      } catch (error) {
        console.error("Error initializing tasks:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, [id, user, participant]);

  // Subscribe to boards, columns, and tasks
  useEffect(() => {
    if (!id || !user || isInitializing) return;

    const boardsRef = collection(db, `projects/${id}/task_boards`);
    const unsubBoards = onSnapshot(query(boardsRef, orderBy("createdAt", "asc")), (snapshot) => {
      const boardsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskBoard));
      setBoards(boardsData);
      if (boardsData.length > 0 && !selectedBoardId) {
        const defaultBoard = boardsData.find(b => b.isDefault) || boardsData[0];
        setSelectedBoardId(defaultBoard.id);
      }
    });

    const tasksRef = collection(db, `projects/${id}/tasks`);
    const unsubTasks = onSnapshot(query(tasksRef, where("archived", "==", false), orderBy("order", "asc")), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskItem)));
      setLoading(false);
    });

    return () => {
      unsubBoards();
      unsubTasks();
    };
  }, [id, user, isInitializing, selectedBoardId]);

  // Subscribe to columns for selected board
  useEffect(() => {
    if (!id || !selectedBoardId) return;

    const columnsRef = collection(db, `projects/${id}/task_columns`);
    const unsubColumns = onSnapshot(
      query(columnsRef, where("boardId", "==", selectedBoardId), orderBy("order", "asc")), 
      (snapshot) => {
        setColumns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskColumn)));
      }
    );

    return () => unsubColumns();
  }, [id, selectedBoardId]);

  // Fetch participants
  useEffect(() => {
    if (!id) return;
    const unsubParts = onSnapshot(collection(db, `projects/${id}/participants`), (snapshot) => {
      setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubParts();
  }, [id]);

  const handleMoveTask = async (taskId: string, columnId: string, status: string, order: number) => {
    if (!id || !user || !participant) return;
    try {
      await taskService.moveTask(id, taskId, columnId, status, order, user.uid, participant.role);
    } catch (error) {
      console.error("Error moving task:", error);
      toast.error("Ошибка при перемещении задачи");
    }
  };

  const handleTaskClick = (task: TaskItem) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  if (loading || isInitializing) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-medium animate-pulse">Инициализация задач...</p>
      </div>
    );
  }

  const canManage = participant?.role === 'owner' || participant?.role === 'manager' || participant?.role === 'tech';
  const canCreate = canManage || participant?.role === 'seller';

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.linkedBookingCode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'my-tasks' && user) {
      return matchesSearch && t.assigneeUids.includes(user.uid);
    }
    
    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-[0.2em]">
            <CheckSquare className="w-4 h-4" />
            {project?.title}
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase italic">Задачи</h1>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button 
              onClick={handleCreateTask}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Создать задачу
            </button>
          )}
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex p-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('kanban')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'kanban' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            Kanban
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'list' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <List className="w-4 h-4" />
            Список
          </button>
          <button 
            onClick={() => setActiveTab('my-tasks')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'my-tasks' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <User className="w-4 h-4" />
            Мои задачи
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text"
              placeholder="Поиск задач..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all w-full md:w-64"
            />
          </div>
          <button className="p-3 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {activeTab === 'kanban' && (
          <KanbanBoard 
            columns={columns} 
            tasks={filteredTasks} 
            onMoveTask={handleMoveTask}
            onTaskClick={handleTaskClick}
          />
        )}
        {activeTab === 'list' && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Задача</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Статус</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Приоритет</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Срок</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Исполнители</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTasks.map(task => (
                  <tr 
                    key={task.id} 
                    onClick={() => handleTaskClick(task)}
                    className="group hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{task.title}</span>
                        {task.linkedBookingCode && (
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            Бронь: {task.linkedBookingCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/5">
                        {task.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border",
                        task.priority === 'critical' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        task.priority === 'high' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                        task.priority === 'medium' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        task.dueDate && task.dueDate.toMillis() < Date.now() && task.status !== 'done' ? "text-red-400" : "text-slate-500"
                      )}>
                        {task.dueDate ? new Date(task.dueDate.toMillis()).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end -space-x-2">
                        {task.assigneeUids.map(uid => (
                          <div key={uid} className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-white">
                            {uid[0].toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'my-tasks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">Просрочено</h3>
                </div>
                <div className="text-3xl font-black text-white italic">
                  {filteredTasks.filter(t => t.dueDate && t.dueDate.toMillis() < Date.now() && t.status !== 'done').length}
                </div>
              </div>
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">На сегодня</h3>
                </div>
                <div className="text-3xl font-black text-white italic">
                  {filteredTasks.filter(t => {
                    if (!t.dueDate) return false;
                    const date = new Date(t.dueDate.toMillis());
                    const today = new Date();
                    return date.toDateString() === today.toDateString();
                  }).length}
                </div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckSquare className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Завершено</h3>
                </div>
                <div className="text-3xl font-black text-white italic">
                  {filteredTasks.filter(t => t.status === 'done').length}
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden">
              {/* Reuse list view for my tasks */}
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-white/5">
                  {filteredTasks.map(task => (
                    <tr 
                      key={task.id} 
                      onClick={() => handleTaskClick(task)}
                      className="group hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all",
                            task.status === 'done' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/5 text-slate-500"
                          )}>
                            <CheckSquare className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{task.title}</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                              {task.status} • {task.priority}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          task.dueDate && task.dueDate.toMillis() < Date.now() && task.status !== 'done' ? "text-red-400" : "text-slate-500"
                        )}>
                          {task.dueDate ? new Date(task.dueDate.toMillis()).toLocaleDateString() : "Без срока"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Task Modal */}
      {id && user && participant && (
        <TaskModal 
          projectId={id}
          task={selectedTask}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          participants={participants}
          currentUserUid={user.uid}
          actorRole={participant.role}
          initialColumnId={columns[0]?.id}
          initialStatus={columns[0]?.title.toLowerCase().replace(/\s+/g, '_')}
        />
      )}
    </div>
  );
}
