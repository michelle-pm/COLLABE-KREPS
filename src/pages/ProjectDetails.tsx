import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  getDoc,
  Timestamp
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Project, ProjectComment, UserProfile } from "../types";
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  MoreVertical,
  UserPlus,
  Settings as SettingsIcon
} from "lucide-react";
import { toast } from "sonner";

interface ParticipantItemProps {
  uid: string;
  isOwner: boolean;
  key?: string;
}

function ParticipantItem({ uid, isOwner }: ParticipantItemProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, "users", uid)).then(d => {
      if (d.exists()) setProfile(d.data() as UserProfile);
    });
  }, [uid]);

  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold border border-white/5">
          {profile?.name?.[0] || "?"}
        </div>
        <div>
          <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
            {profile?.name || "Загрузка..."}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
            {isOwner ? "Владелец" : "Участник"}
          </div>
        </div>
      </div>
      <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-white transition-all">
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<(ProjectComment & { author?: UserProfile })[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    console.log("ProjectDetails mounted with id:", id);
    if (!id || !user) return;

    // Subscribe to project details
    const unsubscribeProject = onSnapshot(
      doc(db, "projects", id),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProject({ 
            id: docSnap.id, 
            ...data,
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
          } as Project);
        } else {
          toast.error("Проект не найден");
          navigate("/projects");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Project details error:", err);
        handleFirestoreError(err, OperationType.GET, `projects/${id}`);
        setLoading(false);
      }
    );

    // Subscribe to comments
    const commentsQuery = query(
      collection(db, "projects", id, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeComments = onSnapshot(
      commentsQuery,
      async (snapshot) => {
        const commentsData = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data() as ProjectComment;
          let author: UserProfile | undefined;
          try {
            const userDoc = await getDoc(doc(db, "users", data.authorUid));
            if (userDoc.exists()) author = userDoc.data() as UserProfile;
          } catch (e) {
            console.error("Error fetching comment author:", e);
          }
          return { id: d.id, ...data, author };
        }));
        setComments(commentsData);
      },
      (err) => {
        console.error("Comments error:", err);
        // Don't fail the whole page if comments fail
      }
    );

    return () => {
      unsubscribeProject();
      unsubscribeComments();
    };
  }, [id, user, navigate]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id || !user) return;
    setSending(true);

    try {
      await addDoc(collection(db, "projects", id, "comments"), {
        projectId: id,
        authorUid: user.uid,
        text: newComment.trim(),
        createdAt: serverTimestamp()
      });
      setNewComment("");
    } catch (error) {
      console.error("Add comment error:", error);
      toast.error("Ошибка при отправке комментария");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="text-white text-xl animate-pulse">Загрузка проекта...</div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={() => navigate("/projects")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Назад к проектам
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
              {project.title}
            </h1>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${
              project.status === 'active' ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-700 text-slate-300'
            }`}>
              {project.status === 'active' ? 'Active' : project.status}
            </div>
          </div>
          <p className="text-xl text-slate-400 max-w-2xl font-serif italic leading-relaxed">
            {project.description || "У этого проекта пока нет описания. Добавьте его, чтобы участники понимали цели и задачи."}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl border border-white/10 transition-all active:scale-95">
            <UserPlus className="w-6 h-6" />
          </button>
          <button className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl border border-white/10 transition-all active:scale-95">
            <SettingsIcon className="w-6 h-6" />
          </button>
          <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
            Завершить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content - Comments/Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
            <div className="flex items-center gap-3 mb-8">
              <MessageSquare className="w-6 h-6 text-indigo-500" />
              <h2 className="text-2xl font-bold text-white tracking-tight">Обсуждение</h2>
            </div>

            <div className="space-y-8 mb-8 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
              {comments.length > 0 ? (comments.map((comment) => (
                <div key={comment.id} className="flex gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-bold shrink-0 border border-white/5">
                    {comment.author?.name?.[0] || "?"}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{comment.author?.name || "Аноним"}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                        {comment.createdAt instanceof Timestamp ? comment.createdAt.toDate().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 group-hover:border-white/10 transition-colors">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))) : (
                <div className="text-center py-12 text-slate-500 italic">
                  Пока нет комментариев. Будьте первым!
                </div>
              )}
            </div>

            <form onSubmit={handleAddComment} className="relative">
              <textarea 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Напишите что-нибудь..."
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all h-24 resize-none"
              />
              <button 
                type="submit"
                disabled={sending || !newComment.trim()}
                className="absolute right-3 bottom-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white p-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar - Info/Participants */}
        <div className="space-y-6">
          {/* Stats Card */}
          <div className="bg-indigo-500 rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-500/20">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Прогресс</span>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-6xl font-black italic tracking-tighter mb-2">74%</div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white w-[74%]" />
            </div>
            <p className="mt-4 text-sm font-medium opacity-80">
              Проект движется по графику. Осталось 3 задачи до завершения этапа.
            </p>
          </div>

          {/* Participants Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="text-xl font-bold text-white">Команда</h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">{project.participant_uids.length}</span>
            </div>
            <div className="space-y-4">
              {project.participant_uids.map((uid) => (
                <ParticipantItem key={uid} uid={uid} isOwner={uid === project.owner_uid} />
              ))}
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-indigo-500" />
              <h3 className="text-xl font-bold text-white">История</h3>
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-px bg-white/10 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500" />
                </div>
                <div className="pb-4">
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Сегодня</div>
                  <p className="text-sm text-slate-300">Проект был обновлен</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-px bg-white/10 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/20" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">
                    {new Date(project.updatedAt).toLocaleDateString('ru-RU')}
                  </div>
                  <p className="text-sm text-slate-300">Создание проекта</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
