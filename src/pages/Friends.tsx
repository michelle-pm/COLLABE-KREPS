import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { useAuth } from "../components/FirebaseProvider";
import { Friend, FriendRequest, UserProfile } from "../types";
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Check, 
  X, 
  Search,
  MessageSquare,
  MoreVertical
} from "lucide-react";
import { toast } from "sonner";

export function Friends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const [friendIds, setFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch friends
    const friendsQuery = query(
      collection(db, "friends"),
      where("status", "==", "accepted"),
      where("participant1", "==", user.uid)
    );
    const friendsQuery2 = query(
      collection(db, "friends"),
      where("status", "==", "accepted"),
      where("participant2", "==", user.uid)
    );

    const unsubscribeFriends1 = onSnapshot(friendsQuery, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().participant2);
      setFriendIds(prev => Array.from(new Set([...prev, ...ids])));
    });

    const unsubscribeFriends2 = onSnapshot(friendsQuery2, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().participant1);
      setFriendIds(prev => Array.from(new Set([...prev, ...ids])));
    });

    // Fetch friend requests
    const requestsQuery = query(
      collection(db, "friend_requests"),
      where("to", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
      setRequests(requestsData);
    });

    return () => {
      unsubscribeFriends1();
      unsubscribeFriends2();
      unsubscribeRequests();
    };
  }, [user]);

  useEffect(() => {
    const fetchProfiles = async () => {
      if (friendIds.length === 0) return;
      const profiles: UserProfile[] = [];
      for (const id of friendIds) {
        if (friends.some(f => f.uid === id)) continue;
        const docSnap = await getDocs(query(collection(db, "users"), where("uid", "==", id)));
        if (!docSnap.empty) {
          profiles.push(docSnap.docs[0].data() as UserProfile);
        }
      }
      if (profiles.length > 0) {
        setFriends(prev => {
          const combined = [...prev, ...profiles];
          return combined.filter((v, i, a) => a.findIndex(t => t.uid === v.uid) === i);
        });
      }
    };
    fetchProfiles();
  }, [friendIds]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", searchQuery.trim())
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.uid !== user?.uid);
      setSearchResults(results);
      if (results.length === 0) toast.info("Пользователь не найден");
    } catch (error) {
      toast.error("Ошибка поиска");
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (toUid: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "friend_requests"), {
        from: user.uid,
        to: toUid,
        status: "pending",
        createdAt: serverTimestamp()
      });
      toast.success("Заявка отправлена!");
      setSearchResults([]);
      setSearchQuery("");
    } catch (error) {
      toast.error("Ошибка отправки заявки");
    }
  };

  const acceptRequest = async (request: FriendRequest) => {
    try {
      await updateDoc(doc(db, "friend_requests", request.id), {
        status: "accepted"
      });
      await addDoc(collection(db, "friends"), {
        participant1: request.from,
        participant2: request.to,
        status: "accepted",
        createdAt: serverTimestamp()
      });
      toast.success("Заявка принята!");
    } catch (error) {
      toast.error("Ошибка принятия заявки");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white tracking-tight flex items-center gap-4">
          <Users className="w-10 h-10 text-indigo-500" />
          Друзья
        </h1>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
        <input 
          type="text" 
          placeholder="Поиск по email..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-xl"
        />
        <button 
          type="submit"
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? "Поиск..." : "Найти"}
        </button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-6 animate-in slide-in-from-top duration-500">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Результаты поиска
          </h2>
          <div className="space-y-3">
            {searchResults.map(result => (
              <div key={result.uid} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                    {result.name[0]}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{result.name}</p>
                    <p className="text-slate-500 text-xs">{result.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => sendRequest(result.uid)}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-xl transition-all active:scale-95"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friend Requests */}
      {requests.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-6">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-purple-400" />
            Заявки в друзья ({requests.length})
          </h2>
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">
                    ?
                  </div>
                  <div>
                    <p className="text-white font-semibold">Входящая заявка</p>
                    <p className="text-slate-500 text-xs">ID: {req.from.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => acceptRequest(req)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-xl transition-all active:scale-95"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-2 rounded-xl transition-all active:scale-95">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
        <h2 className="text-2xl font-bold text-white mb-8">Ваши друзья</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {friends.length > 0 ? (
            friends.map(friend => (
              <div key={friend.uid} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                      {friend.name[0]}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-indigo-400 transition-colors">{friend.name}</h3>
                    <p className="text-slate-500 text-xs">{friend.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all">
                    <MessageSquare className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-500">Список друзей пуст.</p>
              <p className="text-slate-600 text-sm mt-1">Используйте поиск выше, чтобы найти знакомых.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
