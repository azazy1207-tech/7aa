import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { X, User, Phone, UserCircle2 } from "lucide-react";

export default function AuthModal({ open, onClose }) {
  const { loginGoogle, loginGuest, loginPhone } = useAuth();
  const [mode, setMode] = useState("choose"); // choose | guest | phone
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const handleGuest = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr("الرجاء إدخال اسمك");
    setLoading(true);
    setErr("");
    try {
      await loginGuest(name.trim());
      onClose();
    } catch (e) {
      setErr("حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  const handlePhone = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return setErr("الاسم ورقم الجوال مطلوبان");
    setLoading(true);
    setErr("");
    try {
      await loginPhone(name.trim(), phone.trim());
      onClose();
    } catch (e) {
      setErr("حدث خطأ، حاول مجدداً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#0F1115]/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="auth-modal-overlay"
    >
      <div
        className="bg-[#1A1D24] rounded-3xl w-full max-w-md p-8 border border-[#2D3748] shadow-2xl relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        data-testid="auth-modal"
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-[#A0AEC0] hover:text-white transition-colors"
          data-testid="auth-modal-close"
        >
          <X size={22} />
        </button>

        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00E5FF] to-[#FFDE00] mb-3 animate-float">
            <span className="text-3xl">🎮</span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {mode === "choose" ? "أهلاً بك" : mode === "guest" ? "دخول كضيف" : "دخول برقم الجوال"}
          </h2>
          <p className="text-[#A0AEC0] text-sm mt-1">اختر طريقة الدخول المناسبة لك</p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={loginGoogle}
              className="w-full bg-white text-[#0F1115] font-bold rounded-xl px-6 py-3 flex items-center justify-center gap-3 hover:-translate-y-0.5 transition-all"
              data-testid="login-google-btn"
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4C12.9 4 4 12.9 4 24s8.9 20 20 20s20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"/>
                <path fill="#FF3D00" d="m6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4C16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C40.9 35.8 44 30.4 44 24c0-1.3-.1-2.5-.4-3.5z"/>
              </svg>
              تسجيل الدخول بـ Google
            </button>

            <button
              onClick={() => { setMode("phone"); setErr(""); }}
              className="w-full bg-[#252932] text-white font-bold rounded-xl px-6 py-3 flex items-center justify-center gap-3 hover:bg-[#2D3748] transition-all border border-[#2D3748]"
              data-testid="login-phone-btn"
            >
              <Phone size={20} />
              تسجيل برقم الجوال
            </button>

            <button
              onClick={() => { setMode("guest"); setErr(""); }}
              className="w-full bg-transparent text-[#00E5FF] font-bold rounded-xl px-6 py-3 flex items-center justify-center gap-3 hover:bg-[#00E5FF]/5 transition-all border border-[#00E5FF]/40"
              data-testid="login-guest-btn"
            >
              <UserCircle2 size={20} />
              الدخول كضيف
            </button>

            <p className="text-xs text-[#718096] text-center mt-4">
              للتداول مع الآخرين يفضل تسجيل الدخول بـ Google أو الجوال
            </p>
          </div>
        )}

        {mode === "guest" && (
          <form onSubmit={handleGuest} className="space-y-4">
            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">اسمك</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: أحمد"
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none"
                data-testid="guest-name-input"
              />
            </div>
            {err && <p className="text-[#FF4B72] text-sm">{err}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-6 py-3 hover:-translate-y-0.5 transition-all disabled:opacity-60"
              data-testid="guest-submit-btn"
            >
              {loading ? "..." : "دخول"}
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="w-full text-[#A0AEC0] text-sm hover:text-white"
              data-testid="back-to-choose-btn"
            >
              ← رجوع
            </button>
          </form>
        )}

        {mode === "phone" && (
          <form onSubmit={handlePhone} className="space-y-4">
            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">الاسم</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد"
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none"
                data-testid="phone-name-input"
              />
            </div>
            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">رقم الجوال</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none text-start"
                data-testid="phone-number-input"
              />
            </div>
            {err && <p className="text-[#FF4B72] text-sm">{err}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-6 py-3 hover:-translate-y-0.5 transition-all disabled:opacity-60"
              data-testid="phone-submit-btn"
            >
              {loading ? "..." : "دخول"}
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="w-full text-[#A0AEC0] text-sm hover:text-white"
            >
              ← رجوع
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
