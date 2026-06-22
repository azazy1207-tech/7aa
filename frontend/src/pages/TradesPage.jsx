import { useEffect, useState } from "react";
import axios from "axios";
import { API, useAuth } from "@/context/AuthContext";
import { Plus, ArrowLeftRight, Users, Clock, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AuthModal from "@/components/AuthModal";

export default function TradesPage() {
  const { user, authHeaders } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [err, setErr] = useState("");

  const refresh = async () => {
    try {
      const r = await axios.get(`${API}/trade-rooms`);
      setRooms(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000); // live refresh
    return () => clearInterval(t);
  }, []);

  const createRoom = async (e) => {
    e?.preventDefault?.();
    if (!user) return setAuthOpen(true);
    setCreating(true);
    setErr("");
    try {
      const r = await axios.post(
        `${API}/trade-rooms`,
        { title: title || "غرفة تداول" },
        { headers: authHeaders() }
      );
      navigate(`/trades/room/${r.data.id}`);
    } catch (ex) {
      setErr(ex.response?.data?.detail || "خطأ");
    } finally {
      setCreating(false);
    }
  };

  const enterRoom = async (room) => {
    if (!user) return setAuthOpen(true);
    if (
      room.host_user_id !== user.user_id &&
      room.guest_user_id &&
      room.guest_user_id !== user.user_id
    ) {
      alert("هذه الغرفة ممتلئة");
      return;
    }
    navigate(`/trades/room/${room.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="trades-page">
      {/* Hero */}
      <section className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#1A1D24] to-[#252932] border border-[#2D3748] p-6 md:p-10">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#FF4B72]/10 blur-3xl"></div>
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#FF4B72]/10 text-[#FF4B72] px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
              <ArrowLeftRight size={16} />
              غرف التداول المباشر
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white">انضم لغرفة أو أنشئ غرفتك</h1>
            <p className="text-[#A0AEC0] mt-2">شات مباشر، ٩ مربعات لكل طرف، تحكم في عرضك بنفسك</p>
          </div>
          <button
            onClick={() => (user ? setShowCreate(true) : setAuthOpen(true))}
            className="bg-[#FFDE00] text-[#0F1115] font-bold rounded-xl px-6 py-3 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2 self-start"
            data-testid="open-create-room-btn"
          >
            <Plus size={18} />
            إنشاء غرفة تداول
          </button>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="غرف نشطة" value={rooms.filter((r) => r.status === "active").length} color="#00E5FF" />
        <StatCard label="غرف منتظرة" value={rooms.filter((r) => r.status === "waiting").length} color="#FFDE00" />
        <StatCard label="الإجمالي" value={rooms.length} color="#FF4B72" />
      </div>

      {/* Rooms list */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1A1D24] rounded-2xl h-32 animate-pulse"></div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 text-[#A0AEC0] bg-[#1A1D24] rounded-3xl border border-[#2D3748]" data-testid="no-rooms">
          <div className="text-5xl mb-3">🤝</div>
          <p className="text-lg mb-2">لا توجد غرف تداول حالياً</p>
          <p className="text-sm text-[#718096]">كن أول من ينشئ غرفة!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => enterRoom(room)}
              className="text-start bg-[#1A1D24] rounded-2xl p-5 border border-[#2D3748] hover:border-[#00E5FF] hover:-translate-y-1 transition-all"
              data-testid={`room-card-${room.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg mb-1">{room.title}</h3>
                  <p className="text-xs text-[#A0AEC0]">
                    صاحب الغرفة: <span className="text-[#00E5FF] font-semibold">{room.host_name}</span>
                  </p>
                </div>
                <StatusPill status={room.status} />
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[#A0AEC0]">
                  <Users size={14} />
                  <span>{room.guest_user_id ? "2 / 2" : "1 / 2"}</span>
                </div>
                <div className="flex items-center gap-1 text-[#718096] text-xs">
                  <Clock size={12} />
                  {timeAgo(room.created_at)}
                </div>
              </div>

              {room.status === "waiting" && (
                <div className="mt-3 bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-bold rounded-lg px-3 py-2 text-center">
                  اضغط للانضمام →
                </div>
              )}
              {room.status === "active" && (
                <div className="mt-3 bg-[#FFDE00]/10 text-[#FFDE00] text-xs font-bold rounded-lg px-3 py-2 text-center">
                  جلسة جارية — أدخل لتشاهد
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-[#0F1115]/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={createRoom}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1A1D24] rounded-3xl w-full max-w-md p-8 border border-[#2D3748]"
            data-testid="create-room-modal"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">غرفة تداول جديدة</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-[#A0AEC0]">
                <X size={22} />
              </button>
            </div>
            <label className="block text-sm text-[#A0AEC0] mb-2">عنوان الغرفة</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تداول Frost Dragon"
              className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none mb-4"
              data-testid="room-title-input"
              autoFocus
            />
            {err && <p className="text-[#FF4B72] text-sm mb-2">{err}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-[#FFDE00] text-[#0F1115] font-bold rounded-xl px-4 py-3 hover:-translate-y-0.5 transition-all disabled:opacity-60"
              data-testid="create-room-btn"
            >
              {creating ? "جاري الإنشاء..." : "إنشاء وانتقال للغرفة"}
            </button>
          </form>
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-[#1A1D24] rounded-2xl p-4 border border-[#2D3748]">
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs text-[#A0AEC0] mt-1">{label}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    waiting: { c: "#FFDE00", label: "بانتظار شريك" },
    active: { c: "#00E5FF", label: "نشطة" },
    completed: { c: "#22C55E", label: "مكتملة" },
    cancelled: { c: "#FF4B72", label: "ملغاة" },
  };
  const s = map[status] || map.waiting;
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap" style={{ background: s.c + "20", color: s.c }}>
      {s.label}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `قبل ${Math.floor(diff)} ثانية`;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  return `قبل ${Math.floor(diff / 86400)} يوم`;
}
