import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/context/AuthContext";
import { Plus, X, Send, CheckCircle2, ArrowRight, LogOut, Trash2, Search } from "lucide-react";

export default function TradeRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, authHeaders } = useAuth();
  const [room, setRoom] = useState(null);
  const [products, setProducts] = useState([]);
  const [picker, setPicker] = useState(null); // index for my slot
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const chatEndRef = useRef(null);

  const isHost = user && room?.host_user_id === user.user_id;
  const isGuest = user && room?.guest_user_id === user.user_id;
  const isParticipant = isHost || isGuest;
  const mySlots = isHost ? room?.host_slots : isGuest ? room?.guest_slots : null;
  const theirSlots = isHost ? room?.guest_slots : isGuest ? room?.host_slots : null;
  const theirName = isHost ? room?.guest_name : room?.host_name;
  const myConfirmed = isHost ? room?.host_confirmed : room?.guest_confirmed;
  const theirConfirmed = isHost ? room?.guest_confirmed : room?.host_confirmed;

  const fetchRoom = async () => {
    try {
      const r = await axios.get(`${API}/trade-rooms/${id}`);
      setRoom(r.data);
    } catch (ex) {
      if (ex.response?.status === 404) {
        navigate("/trades");
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    // Join (idempotent for host)
    (async () => {
      try {
        await axios.post(`${API}/trade-rooms/${id}/join`, {}, { headers: authHeaders() });
      } catch (ex) {
        if (ex.response?.status === 409) {
          setErr("الغرفة ممتلئة، لا يمكنك الانضمام");
        }
      }
      fetchRoom();
    })();
    // Poll every 2 seconds
    const t = setInterval(fetchRoom, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.user_id]);

  useEffect(() => {
    axios.get(`${API}/products`).then((r) => setProducts(r.data.filter((p) => p.is_tradeable !== false)));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages?.length]);

  const updateMySlots = async (newSlots) => {
    try {
      const r = await axios.put(
        `${API}/trade-rooms/${id}/slots`,
        { slots: newSlots },
        { headers: authHeaders() }
      );
      setRoom(r.data);
    } catch (ex) {
      setErr(ex.response?.data?.detail || "خطأ");
    }
  };

  const pickProduct = (p) => {
    const next = [...mySlots];
    next[picker] = { product_id: p.id, product_name: p.name, product_image: p.image };
    setPicker(null);
    updateMySlots(next);
  };

  const clearSlot = (i) => {
    const next = [...mySlots];
    next[i] = { product_id: null, product_name: null, product_image: null };
    updateMySlots(next);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    setSending(true);
    try {
      await axios.post(
        `${API}/trade-rooms/${id}/messages`,
        { text: chatText.trim() },
        { headers: authHeaders() }
      );
      setChatText("");
      fetchRoom();
    } catch (ex) {
      setErr(ex.response?.data?.detail || "خطأ");
    } finally {
      setSending(false);
    }
  };

  const confirmTrade = async () => {
    try {
      const r = await axios.post(
        `${API}/trade-rooms/${id}/confirm`,
        {},
        { headers: authHeaders() }
      );
      setRoom(r.data);
    } catch (ex) {
      setErr(ex.response?.data?.detail || "خطأ");
    }
  };

  const leaveRoom = async () => {
    if (!window.confirm(isHost ? "إغلاق الغرفة؟" : "الخروج من الغرفة؟")) return;
    try {
      await axios.post(`${API}/trade-rooms/${id}/leave`, {}, { headers: authHeaders() });
    } catch (_) {
      // ignore
    }
    navigate("/trades");
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#1A1D24] rounded-3xl p-10 border border-[#2D3748]">
          <h2 className="text-2xl font-bold text-white mb-2">يلزمك تسجيل الدخول</h2>
          <p className="text-[#A0AEC0] mb-4">للدخول في غرف التداول لازم تسجل دخول</p>
          <button
            onClick={() => navigate("/trades")}
            className="bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-5 py-3"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-[#A0AEC0] mt-3">جاري تحميل الغرفة...</p>
      </div>
    );
  }

  const status = room.status;
  const tradeComplete = status === "completed";
  const cancelled = status === "cancelled";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="trade-room-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button onClick={() => navigate("/trades")} className="text-[#A0AEC0] hover:text-white flex items-center gap-1 text-sm">
          <ArrowRight size={16} /> رجوع للغرف
        </button>
        <div className="flex gap-2">
          {isParticipant && status === "active" && !myConfirmed && (
            <button
              onClick={confirmTrade}
              className="bg-[#22C55E] text-white font-bold rounded-xl px-4 py-2 inline-flex items-center gap-2 hover:-translate-y-0.5 transition-all"
              data-testid="confirm-trade-btn"
            >
              <CheckCircle2 size={16} /> تأكيد الصفقة
            </button>
          )}
          {isParticipant && (
            <button
              onClick={leaveRoom}
              className="bg-[#252932] text-[#FF4B72] rounded-xl px-4 py-2 inline-flex items-center gap-2 hover:bg-[#FF4B72]/10"
              data-testid="leave-room-btn"
            >
              <LogOut size={16} /> {isHost ? "إغلاق" : "خروج"}
            </button>
          )}
        </div>
      </div>

      {/* Title bar */}
      <div className="bg-gradient-to-l from-[#1A1D24] to-[#252932] rounded-3xl p-5 border border-[#2D3748] mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">{room.title}</h1>
            <p className="text-xs text-[#A0AEC0] mt-1">
              <span className="text-[#00E5FF] font-semibold">{room.host_name}</span>
              {room.guest_name && (
                <>
                  {" "}↔{" "}
                  <span className="text-[#FF4B72] font-semibold">{room.guest_name}</span>
                </>
              )}
            </p>
          </div>
          <StatusBanner status={status} />
        </div>
        {tradeComplete && (
          <div className="mt-3 bg-[#22C55E]/15 text-[#22C55E] rounded-xl p-3 text-center font-bold flex items-center justify-center gap-2">
            <CheckCircle2 size={20} /> تمت الصفقة بنجاح! 🎉
          </div>
        )}
        {cancelled && (
          <div className="mt-3 bg-[#FF4B72]/15 text-[#FF4B72] rounded-xl p-3 text-center font-bold">
            تم إلغاء الغرفة
          </div>
        )}
      </div>

      {err && <div className="bg-[#FF4B72]/15 text-[#FF4B72] rounded-xl p-3 mb-3 text-sm">{err}</div>}

      <div className="grid lg:grid-cols-[1fr_1fr_360px] gap-4">
        {/* My slots */}
        <SlotPanel
          title={isHost || isGuest ? "تداولك" : "صاحب الغرفة"}
          name={user.name}
          color="#00E5FF"
          slots={isHost || isGuest ? mySlots : room.host_slots}
          editable={isHost || isGuest}
          confirmed={myConfirmed}
          onSlotClick={(i) => setPicker(i)}
          onClear={clearSlot}
          side="mine"
          status={status}
        />
        {/* Their slots */}
        <SlotPanel
          title={isHost || isGuest ? `${theirName || "بانتظار شريك"}` : "الطرف الثاني"}
          name={isHost || isGuest ? theirName : room.guest_name}
          color="#FF4B72"
          slots={isHost || isGuest ? theirSlots : room.guest_slots}
          editable={false}
          confirmed={theirConfirmed}
          waiting={!theirName && (isHost || isGuest)}
          side="theirs"
          status={status}
        />
        {/* Chat */}
        <ChatPanel
          messages={room.messages || []}
          user={user}
          onSend={sendMessage}
          text={chatText}
          setText={setChatText}
          sending={sending}
          canChat={isParticipant && status !== "cancelled"}
          chatEndRef={chatEndRef}
        />
      </div>

      {/* Product picker */}
      {picker !== null && (
        <ProductPicker
          products={products}
          onPick={pickProduct}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function SlotPanel({ title, name, color, slots, editable, confirmed, waiting, onSlotClick, onClear, side, status }) {
  return (
    <div className="bg-[#1A1D24] rounded-3xl p-4 border-2 transition-all" style={{ borderColor: confirmed ? "#22C55E" : "#2D3748" }} data-testid={`panel-${side}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          {name && <p className="text-xs" style={{ color }}>{name}</p>}
        </div>
        {confirmed ? (
          <span className="bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
            <CheckCircle2 size={10} /> مؤكد
          </span>
        ) : (
          <div className="w-3 h-3 rounded-full" style={{ background: color }}></div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 bg-[#0F1115] p-3 rounded-2xl">
        {(slots || []).map((s, i) => (
          <div
            key={i}
            data-testid={`slot-${side}-${i}`}
            className="aspect-square rounded-xl relative group"
            style={{
              border: s?.product_id ? `2px solid ${color}` : "2px dashed #2D3748",
              background: s?.product_id ? "transparent" : "#1A1D24",
              cursor: editable && !s?.product_id ? "pointer" : "default",
            }}
            onClick={() => editable && !s?.product_id && onSlotClick(i)}
          >
            {s?.product_id ? (
              <>
                <img src={s.product_image} alt={s.product_name} className="w-full h-full object-cover rounded-[10px]" />
                {editable && status === "active" && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClear(i); }}
                    className="absolute -top-1 -right-1 bg-[#FF4B72] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`clear-slot-${side}-${i}`}
                  >
                    <X size={10} />
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-[#718096]">
                {editable ? <Plus size={20} /> : null}
              </div>
            )}
          </div>
        ))}
      </div>
      {waiting && (
        <div className="mt-3 bg-[#FFDE00]/10 text-[#FFDE00] text-xs font-bold rounded-xl p-2 text-center">
          ⏳ بانتظار شخص ينضم...
        </div>
      )}
    </div>
  );
}

function ChatPanel({ messages, user, onSend, text, setText, sending, canChat, chatEndRef }) {
  return (
    <div className="bg-[#1A1D24] rounded-3xl border border-[#2D3748] flex flex-col" style={{ minHeight: "400px", maxHeight: "600px" }} data-testid="chat-panel">
      <div className="p-3 border-b border-[#2D3748]">
        <h3 className="font-bold text-white text-sm">💬 الدردشة</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
        {(messages || []).length === 0 ? (
          <p className="text-xs text-[#718096] text-center py-8">لا توجد رسائل بعد</p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === user.user_id;
            return (
              <div key={m.id || m.ts} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-[#00E5FF] text-[#0F1115]" : "bg-[#252932] text-white"}`}>
                  {!mine && <div className="text-[10px] font-bold text-[#FF4B72] mb-0.5">{m.name}</div>}
                  <div className="text-sm break-words">{m.text}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={onSend} className="p-3 border-t border-[#2D3748] flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={canChat ? "اكتب رسالتك..." : "غير متاح"}
          disabled={!canChat || sending}
          className="flex-1 bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white text-sm focus:border-[#00E5FF] outline-none disabled:opacity-50"
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={!canChat || sending || !text.trim()}
          className="bg-[#00E5FF] text-[#0F1115] rounded-xl px-3 py-2 disabled:opacity-40 hover:-translate-y-0.5 transition-all"
          data-testid="chat-send-btn"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

function ProductPicker({ products, onPick, onClose }) {
  const [q, setQ] = useState("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 bg-[#0F1115]/85 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1D24] rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden border border-[#2D3748]" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#2D3748] flex items-center justify-between">
          <h3 className="font-bold text-white">اختر منتج</h3>
          <button onClick={onClose} className="text-[#A0AEC0]" data-testid="close-picker-btn">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096]" size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث..."
              className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl pe-10 ps-3 py-2 text-white focus:border-[#00E5FF] outline-none"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-[55vh] overflow-y-auto pe-1">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                className="text-start bg-[#0F1115] rounded-xl p-2 border border-[#2D3748] hover:border-[#00E5FF] hover:-translate-y-0.5 transition-all"
                data-testid={`pick-product-${p.id}`}
              >
                <div className="aspect-square rounded-lg overflow-hidden bg-[#252932] mb-2">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="text-white text-xs font-bold truncate">{p.name}</div>
                <div className="text-[#FFDE00] text-xs">{p.price} ر.س</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-[#A0AEC0] py-10">لا توجد منتجات</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ status }) {
  const map = {
    waiting: { c: "#FFDE00", label: "⏳ بانتظار شريك" },
    active: { c: "#00E5FF", label: "🟢 جلسة نشطة" },
    completed: { c: "#22C55E", label: "✅ مكتملة" },
    cancelled: { c: "#FF4B72", label: "❌ ملغاة" },
  };
  const s = map[status] || map.waiting;
  return (
    <span className="text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: s.c + "20", color: s.c }}>
      {s.label}
    </span>
  );
}
