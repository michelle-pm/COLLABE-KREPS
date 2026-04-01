import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  limit
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Chat, Message, UserProfile } from "../types";
import { 
  MessageSquare, 
  Send, 
  Search, 
  MoreVertical, 
  Smile, 
  Paperclip,
  ChevronLeft,
  Clock
} from "lucide-react";
import { toast } from "sonner";

export function Messages() {
  const { user } = useAuth();
  const [chats, setChats] = useState<(Chat & { otherUser?: UserProfile })[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageTimestamp", "desc")
    );

    const unsubscribeChats = onSnapshot(
      chatsQuery, 
      async (snapshot) => {
        const chatsData = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data() as Chat;
          const otherUserId = data.participants.find(id => id !== user.uid);
          let otherUser: UserProfile | undefined;
          if (otherUserId) {
            const userDoc = await getDoc(doc(db, "users", otherUserId));
            if (userDoc.exists()) otherUser = userDoc.data() as UserProfile;
          }
          return { id: d.id, ...data, otherUser };
        }));
        setChats(chatsData);
        setLoading(false);
      },
      (err) => {
        console.error("Chats error:", err);
        if (err.code === 'failed-precondition') {
          setError("Для быстрой работы требуется создать индекс в Firebase. Вы можете сделать это по ссылке из консоли браузера или подождать, пока мы загрузим данные в упрощенном режиме.");
          // Fallback for missing index
          const simpleQuery = query(
            collection(db, "chats"),
            where("participants", "array-contains", user.uid)
          );
          getDocs(simpleQuery).then(async (snapshot) => {
            const chatsData = await Promise.all(snapshot.docs.map(async (d) => {
              const data = d.data() as Chat;
              const otherUserId = data.participants.find(id => id !== user.uid);
              let otherUser: UserProfile | undefined;
              if (otherUserId) {
                const userDoc = await getDoc(doc(db, "users", otherUserId));
                if (userDoc.exists()) otherUser = userDoc.data() as UserProfile;
              }
              return { id: d.id, ...data, otherUser };
            }));
            setChats(chatsData.sort((a, b) => (b.lastMessageTimestamp?.toMillis() || 0) - (a.lastMessageTimestamp?.toMillis() || 0)));
            setLoading(false);
          }).catch(e => console.error("Fallback chats query failed:", e));
        }
      }
    );

    return () => unsubscribeChats();
  }, [user]);

  useEffect(() => {
    if (!activeChat) return;

    const messagesQuery = query(
      collection(db, "chats", activeChat.id, "messages"),
      orderBy("timestamp", "asc"),
      limit(50)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(messagesData);
      scrollToBottom();
    });

    return () => unsubscribeMessages();
  }, [activeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    try {
      await addDoc(collection(db, "chats", activeChat.id, "messages"), {
        chatId: activeChat.id,
        senderId: user.uid,
        text: newMessage.trim(),
        timestamp: serverTimestamp()
      });
      setNewMessage("");
    } catch (error) {
      toast.error("Ошибка отправки сообщения");
    }
  };

  if (loading) return <div className="text-white text-center py-20">Загрузка сообщений...</div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-amber-400 text-sm">
          <Clock className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}
      <div className="h-[calc(100vh-220px)] flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-white/10 flex flex-col bg-white/5">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-indigo-500" />
            Чаты
          </h1>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Поиск чатов..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.length > 0 ? (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all text-left border-b border-white/5 ${activeChat?.id === chat.id ? 'bg-indigo-500/10 border-l-4 border-l-indigo-500' : ''}`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                    {chat.otherUser?.name?.[0] || "?"}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white font-semibold truncate">{chat.otherUser?.name || "Пользователь"}</h3>
                    <span className="text-[10px] text-slate-500">
                      {chat.updatedAt?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs truncate">{chat.lastMessage || "Нет сообщений"}</p>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">
              У вас пока нет активных чатов.
            </div>
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col relative bg-slate-950/20">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <header className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button className="md:hidden p-2 text-slate-400 hover:text-white transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  {chats.find(c => c.id === activeChat.id)?.otherUser?.name?.[0] || "?"}
                </div>
                <div>
                  <h2 className="text-white font-bold">{chats.find(c => c.id === activeChat.id)?.otherUser?.name || "Чат"}</h2>
                  <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    В сети
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                  <Search className="w-5 h-5" />
                </button>
                <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className={`max-w-[70%] p-4 rounded-2xl shadow-lg relative group ${
                    msg.senderId === user?.uid 
                      ? 'bg-indigo-500 text-white rounded-tr-none' 
                      : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <div className={`flex items-center gap-1 mt-1 ${msg.senderId === user?.uid ? 'justify-end text-indigo-200' : 'justify-start text-slate-500'}`}>
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px]">
                        {msg.timestamp?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <footer className="p-6 border-t border-white/10 bg-white/5">
              <form onSubmit={sendMessage} className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button type="button" className="p-2 text-slate-500 hover:text-indigo-400 transition-colors">
                    <Smile className="w-6 h-6" />
                  </button>
                  <button type="button" className="p-2 text-slate-500 hover:text-indigo-400 transition-colors">
                    <Paperclip className="w-6 h-6" />
                  </button>
                </div>
                <input 
                  type="text" 
                  placeholder="Напишите сообщение..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-6 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white p-3 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
              <MessageSquare className="w-12 h-12 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ваши сообщения</h2>
            <p className="text-slate-500 max-w-xs">Выберите чат из списка слева, чтобы начать общение.</p>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
