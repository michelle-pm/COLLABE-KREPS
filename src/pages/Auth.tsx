import React, { useState } from "react";
import { auth, db } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Mail, Lock, User, Chrome, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("С возвращением!");
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email,
          name,
          createdAt: new Date().toISOString(),
        });
        toast.success("Аккаунт создан!");
      }
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const { user } = await signInWithPopup(auth, provider);
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email,
          name: user.displayName || "Пользователь",
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
        });
      }
      toast.success("Вход выполнен!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Коллаб</h1>
            <p className="text-slate-400 mt-2">
              {isLogin ? "Войдите в свой аккаунт" : "Создайте новый аккаунт"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Загрузка..." : isLogin ? "Войти" : "Зарегистрироваться"}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <span className="relative px-4 bg-slate-950/50 text-slate-500 text-sm">ИЛИ</span>
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <Chrome className="w-5 h-5" />
              Войти через Google
            </button>
          </div>

          <p className="mt-8 text-center text-slate-400">
            {isLogin ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
            >
              {isLogin ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
