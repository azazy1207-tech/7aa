import { useEffect, useState } from "react";
import axios from "axios";
import { API, useAuth } from "@/context/AuthContext";
import { categoryLabel } from "@/lib/categories";
import { Plus, X, ArrowLeftRight, Send, Trash2, Search, ShieldCheck } from "lucide-react";
import AuthModal from "@/components/AuthModal";

const emptySlots = () => Array.from({ length: 9 }, () => ({ product_id: null, product_name: null, product_image: null }));

export default function TradesPage() {
  const { user, authHeaders } = useAuth();
  const [trades, setTrades] = useState([]);
  const [products, setProducts] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState("browse"); // browse | create
  const [loading, setLoading] = useState(true);

  // Create form state
  const [offering, setOffering] = useState(emptySlots());
  const [requesting, setRequesting] = useState(emptySlots());
  const [title, setTitle] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(null); // { side, index }
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const refresh = () => {
    setLoading(true);
    axios.get(`${API}/trades`).then((r) => setTrades(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    axios.get(`${API}/products`).then((r) => setProducts(r.data.filter((p) => p.is_tradeable !== false)));
  }, []);

  const openPicker = (side, index) => setPickerOpen({ side, index });
  const closePicker = () => setPickerOpen(null);

  const pickProduct = (p) => {
    const setter = pickerOpen.side === "offering" ? setOffering : setRequesting;
    setter((prev) => {
      const next = [...prev];
      next[pickerOpen.index] = { product_id: p.id, product_name: p.name, product_image: p.image };
      return next;
    });
    closePicker();
  };

  const clearSlot = (side, index) => {
    const setter = side === "offering" ? setOffering : setRequesting;
    setter((prev) => {
      const next = [...prev];
      next[index] = { product_id: null, product_name: null, product_image: null };
      return next;
    });
  };

  const submitTrade = async (e) => {
    e.preventDefault();
    setErr("");
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!offering.some((s) => s.product_id) || !requesting.some((s) => s.product_id)) {
      setErr("ضع عنصر واحد على الأقل في كل جهة");
      return;
    }
    setCreating(true);
    try {
      await axios.post(
        `${API}/trades`,
        {
          title: title || "تداول جديد",
          offering,
          requesting,
          contact,
          notes,
        },
        { headers: authHeaders(), withCredentials: true }
      );
      setOffering(emptySlots());
      setRequesting(emptySlots());
      setTitle("");
      setContact("");
      setNotes("");
      setTab("browse");
      refresh();
    } catch (e) {
      setErr(e.response?.data?.detail || "حدث خطأ");
    } finally {
      setCreating(false);
    }
  };

  const acceptTrade = async (id) => {
    if (!user) return setAuthOpen(true);
    try {
      await axios.post(`${API}/trades/${id}/accept`, {}, { headers: authHeaders(), withCredentials: true });
      refresh();
    } catch (e) {
      alert(e.response?.data?.detail || "حدث خطأ");
    }
  };

  const deleteMine = async (id) => {
    if (!window.confirm("حذف هذا التداول؟")) return;
    try {
      await axios.delete(`${API}/trades/${id}`, { headers: authHeaders(), withCredentials: true });
      refresh();
    } catch (_) {
      // ignore
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="trades-page">
      {/* Header */}
      <section className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#1A1D24] to-[#252932] border border-[#2D3748] p-6 md:p-10">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#FF4B72]/10 blur-3xl"></div>
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#FF4B72]/10 text-[#FF4B72] px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
              <ArrowLeftRight size={16} />
              قسم التداول
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white">بادل عناصرك مع لاعبين آخرين</h1>
            <p className="text-[#A0AEC0] mt-2">٩ مربعات لما تعرضه، و٩ لما تطلبه</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("browse")}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all ${
                tab === "browse" ? "bg-[#00E5FF] text-[#0F1115]" : "bg-[#252932] text-white"
              }`}
              data-testid="tab-browse"
            >
              <Search size={16} className="inline ms-1" />
              التصفح
            </button>
            <button
              onClick={() => setTab("create")}
              className={`px-5 py-2.5 rounded-xl font-bold transition-all ${
                tab === "create" ? "bg-[#FFDE00] text-[#0F1115]" : "bg-[#252932] text-white"
              }`}
              data-testid="tab-create"
            >
              <Plus size={16} className="inline ms-1" />
              إنشاء
            </button>
          </div>
        </div>
      </section>

      {tab === "browse" ? (
        <BrowseTrades trades={trades} loading={loading} user={user} onAccept={acceptTrade} onDelete={deleteMine} />
      ) : (
        <form onSubmit={submitTrade} className="space-y-6" data-testid="trade-form">
          <div>
            <label className="block text-sm text-[#A0AEC0] mb-2">عنوان التداول</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تداول Shadow Dragon"
              className="w-full bg-[#1A1D24] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none"
              data-testid="trade-title-input"
            />
          </div>

          <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <SlotPanel
              title="ما أعرضه"
              slots={offering}
              color="#00E5FF"
              onSlotClick={(i) => openPicker("offering", i)}
              onClear={(i) => clearSlot("offering", i)}
              side="offering"
            />
            <div className="flex md:flex-col items-center justify-center text-[#FFDE00] py-4">
              <div className="bg-[#FFDE00]/10 rounded-full p-4 animate-pulse-glow">
                <ArrowLeftRight size={32} />
              </div>
            </div>
            <SlotPanel
              title="ما أطلبه"
              slots={requesting}
              color="#FF4B72"
              onSlotClick={(i) => openPicker("requesting", i)}
              onClear={(i) => clearSlot("requesting", i)}
              side="requesting"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">طريقة التواصل (Discord / WhatsApp)</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="مثال: yusef#1234"
                className="w-full bg-[#1A1D24] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none"
                data-testid="trade-contact-input"
              />
            </div>
            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">ملاحظات</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي تفاصيل إضافية..."
                className="w-full bg-[#1A1D24] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none"
                data-testid="trade-notes-input"
              />
            </div>
          </div>

          {err && <p className="text-[#FF4B72] text-sm" data-testid="trade-error">{err}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full md:w-auto bg-[#FFDE00] text-[#0F1115] font-bold rounded-xl px-8 py-4 hover:-translate-y-0.5 transition-all disabled:opacity-60 inline-flex items-center gap-2 text-lg"
            data-testid="submit-trade-btn"
          >
            <Send size={20} />
            {creating ? "..." : "نشر التداول"}
          </button>
        </form>
      )}

      {/* Picker Modal */}
      {pickerOpen && (
        <ProductPicker products={products} onPick={pickProduct} onClose={closePicker} />
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function SlotPanel({ title, slots, color, onSlotClick, onClear, side }) {
  return (
    <div className="bg-[#1A1D24] rounded-3xl p-4 border border-[#2D3748]" data-testid={`slot-panel-${side}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-white text-lg">{title}</h3>
        <div className="w-3 h-3 rounded-full" style={{ background: color }}></div>
      </div>
      <div className="grid grid-cols-3 gap-2 bg-[#0F1115] p-3 rounded-2xl">
        {slots.map((s, i) => (
          <div
            key={i}
            data-testid={`slot-${side}-${i}`}
            className="aspect-square rounded-xl relative group cursor-pointer"
            style={{
              border: s.product_id ? `2px solid ${color}` : "2px dashed #2D3748",
              background: s.product_id ? "transparent" : "#1A1D24",
            }}
            onClick={() => !s.product_id && onSlotClick(i)}
          >
            {s.product_id ? (
              <>
                <img src={s.product_image} alt={s.product_name} className="w-full h-full object-cover rounded-[10px]" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear(i);
                  }}
                  className="absolute -top-1 -right-1 bg-[#FF4B72] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`clear-slot-${side}-${i}`}
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-[#718096] hover:text-[#00E5FF] transition-colors">
                <Plus size={20} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductPicker({ products, onPick, onClose }) {
  const [q, setQ] = useState("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div
      className="fixed inset-0 bg-[#0F1115]/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="product-picker"
    >
      <div
        className="bg-[#1A1D24] rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden border border-[#2D3748] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#2D3748] flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">اختر منتج</h3>
          <button onClick={onClose} className="text-[#A0AEC0] hover:text-white" data-testid="close-picker-btn">
            <X size={22} />
          </button>
        </div>
        <div className="p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث..."
            className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-2.5 text-white focus:border-[#00E5FF] outline-none mb-3"
            data-testid="picker-search-input"
          />
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

function BrowseTrades({ trades, loading, user, onAccept, onDelete }) {
  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#1A1D24] rounded-3xl h-72 animate-pulse"></div>
        ))}
      </div>
    );
  }
  if (trades.length === 0) {
    return (
      <div className="text-center py-16 text-[#A0AEC0]" data-testid="no-trades">
        <div className="text-5xl mb-3">🤝</div>
        <p>لا توجد تداولات حالياً. كن أول من ينشر تداولاً!</p>
      </div>
    );
  }
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {trades.map((t) => (
        <div key={t.id} className="bg-[#1A1D24] rounded-3xl p-5 border border-[#2D3748] animate-slide-up" data-testid={`trade-card-${t.id}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-white">{t.title}</h3>
              <p className="text-xs text-[#A0AEC0]">بواسطة <span className="text-[#00E5FF]">{t.creator_name}</span></p>
            </div>
            {t.status === "matched" ? (
              <span className="bg-[#00E5FF]/15 text-[#00E5FF] text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1">
                <ShieldCheck size={12} /> تم المطابقة
              </span>
            ) : (
              <span className="bg-[#FFDE00]/15 text-[#FFDE00] text-xs font-bold px-3 py-1 rounded-lg">مفتوح</span>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-3">
            <MiniGrid slots={t.offering} color="#00E5FF" label="يعرض" />
            <ArrowLeftRight className="text-[#FFDE00]" size={20} />
            <MiniGrid slots={t.requesting} color="#FF4B72" label="يطلب" />
          </div>

          {(t.contact || t.notes) && (
            <div className="bg-[#0F1115] rounded-xl p-3 text-xs space-y-1 mb-3">
              {t.contact && <div><span className="text-[#A0AEC0]">التواصل:</span> <span className="text-white">{t.contact}</span></div>}
              {t.notes && <div><span className="text-[#A0AEC0]">ملاحظات:</span> <span className="text-white">{t.notes}</span></div>}
              {t.status === "matched" && t.matched_with_name && (
                <div className="text-[#00E5FF] font-bold pt-1 border-t border-[#2D3748]">
                  مطابق مع: {t.matched_with_name}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {t.status === "open" && user?.user_id !== t.creator_user_id && (
              <button
                onClick={() => onAccept(t.id)}
                className="flex-1 bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-4 py-2.5 hover:-translate-y-0.5 transition-all"
                data-testid={`accept-trade-${t.id}`}
              >
                قبول التداول
              </button>
            )}
            {user?.user_id === t.creator_user_id && (
              <button
                onClick={() => onDelete(t.id)}
                className="bg-[#252932] text-[#FF4B72] rounded-xl px-4 py-2.5 hover:bg-[#FF4B72]/10 transition-all"
                data-testid={`delete-trade-${t.id}`}
              >
                <Trash2 size={16} />
              </button>
            )}
            {t.status === "open" && !user && (
              <p className="text-xs text-[#A0AEC0]">سجّل الدخول للقبول</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniGrid({ slots, color, label }) {
  return (
    <div>
      <div className="text-[10px] text-[#A0AEC0] mb-1 text-center">{label}</div>
      <div className="grid grid-cols-3 gap-1 bg-[#0F1115] p-1.5 rounded-xl">
        {slots.map((s, i) => (
          <div
            key={i}
            className="aspect-square rounded-md overflow-hidden"
            style={{
              border: s.product_id ? `1.5px solid ${color}` : "1.5px dashed #2D3748",
              background: "#1A1D24",
            }}
            title={s.product_name || ""}
          >
            {s.product_image && <img src={s.product_image} alt="" className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
    </div>
  );
}
