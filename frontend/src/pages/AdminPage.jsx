import { useEffect, useState } from "react";
import { useAuth, API } from "@/context/AuthContext";
import axios from "axios";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { Plus, Edit, Trash2, Save, X, Package, Receipt, Settings, LogOut, Upload, Check, ShieldCheck, ArrowLeftRight, Bell, Send } from "lucide-react";

export default function AdminPage() {
  const { admin, adminLogin, adminLogout, adminHeaders } = useAuth();
  const [tab, setTab] = useState("products");

  if (!admin) return <AdminLogin onLogin={adminLogin} />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="admin-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#FFDE00]/10 text-[#FFDE00] px-3 py-1 rounded-full text-xs font-bold mb-2">
            <ShieldCheck size={14} /> لوحة الأدمن
          </div>
          <h1 className="text-3xl font-black text-white">إدارة المتجر</h1>
        </div>
        <button
          onClick={adminLogout}
          className="bg-[#252932] text-[#FF4B72] rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-[#FF4B72]/10"
          data-testid="admin-logout-btn"
        >
          <LogOut size={16} /> خروج
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: "products", label: "المنتجات", icon: Package },
          { id: "orders", label: "الطلبات", icon: Receipt },
          { id: "bank", label: "بيانات البنك", icon: Settings },
          { id: "trades", label: "التداولات", icon: ArrowLeftRight },
          { id: "telegram", label: "إشعارات تيليجرام", icon: Bell },
        ].map((t) => {
          const Ic = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
                tab === t.id ? "bg-[#00E5FF] text-[#0F1115]" : "bg-[#1A1D24] text-[#A0AEC0] border border-[#2D3748]"
              }`}
              data-testid={`admin-tab-${t.id}`}
            >
              <Ic size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "products" && <ProductsAdmin headers={adminHeaders} />}
      {tab === "orders" && <OrdersAdmin headers={adminHeaders} />}
      {tab === "bank" && <BankAdmin headers={adminHeaders} />}
      {tab === "trades" && <TradesAdmin headers={adminHeaders} />}
      {tab === "telegram" && <TelegramAdmin headers={adminHeaders} />}
    </div>
  );
}

function TelegramAdmin({ headers }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/telegram/status`, { headers: headers() });
      setStatus(r.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const sync = async () => {
    setSyncing(true);
    setMsg("");
    try {
      const r = await axios.post(`${API}/admin/telegram/sync`, {}, { headers: headers() });
      if (r.data.new_chats?.length) {
        setMsg(`✅ تم ربط ${r.data.new_chats.length} حساب جديد!`);
      } else {
        setMsg("ℹ️ لم يتم العثور على حسابات جديدة. تأكد أنك أرسلت /start للبوت ثم اضغط المزامنة.");
      }
      refresh();
    } catch (e) {
      setMsg(e.response?.data?.detail || "خطأ");
    } finally {
      setSyncing(false);
    }
  };

  const test = async () => {
    setMsg("");
    try {
      const r = await axios.post(`${API}/admin/telegram/test`, {}, { headers: headers() });
      setMsg(`📤 تم إرسال ${r.data.sent} رسالة. تحقق من تيليجرام!`);
    } catch (e) {
      setMsg(e.response?.data?.detail || "خطأ");
    }
  };

  const unlink = async (chat_id) => {
    if (!window.confirm("إلغاء ربط هذا الحساب؟")) return;
    await axios.delete(`${API}/admin/telegram/${chat_id}`, { headers: headers() });
    refresh();
  };

  if (loading) return <p className="text-[#A0AEC0]">جاري التحميل...</p>;

  return (
    <div data-testid="telegram-admin" className="max-w-2xl space-y-4">
      <div className="bg-[#1A1D24] rounded-2xl p-6 border border-[#2D3748]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-[#229ED9] flex items-center justify-center">
            <Send className="text-white" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">إشعارات تيليجرام</h2>
            <p className="text-sm text-[#A0AEC0]">احصل على إشعار فوري بكل طلب جديد</p>
          </div>
        </div>

        {status?.bot_username && (
          <div className="bg-[#0F1115] rounded-xl p-4 mb-4 border border-[#2D3748]">
            <p className="text-xs text-[#A0AEC0] mb-1">اسم البوت:</p>
            <a
              href={`https://t.me/${status.bot_username}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#00E5FF] font-bold text-lg hover:underline"
              data-testid="telegram-bot-link"
            >
              @{status.bot_username}
            </a>
          </div>
        )}

        <div className="bg-[#FFDE00]/10 border border-[#FFDE00]/30 rounded-xl p-4 mb-4 text-sm">
          <p className="text-[#FFDE00] font-bold mb-2">📌 كيف تربط حسابك:</p>
          <ol className="list-decimal list-inside space-y-1 text-white">
            <li>افتح البوت أعلاه على تيليجرام</li>
            <li>اضغط <b>Start</b> أو أرسل <code className="bg-[#0F1115] px-1 rounded">/start</code></li>
            <li>اضغط زر <b>"مزامنة الحسابات"</b> أدناه</li>
          </ol>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={sync}
            disabled={syncing}
            className="flex-1 bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-4 py-3 hover:-translate-y-0.5 transition-all disabled:opacity-60"
            data-testid="telegram-sync-btn"
          >
            {syncing ? "جاري المزامنة..." : "🔄 مزامنة الحسابات"}
          </button>
          {status?.linked?.length > 0 && (
            <button
              onClick={test}
              className="bg-[#FFDE00] text-[#0F1115] font-bold rounded-xl px-4 py-3 hover:-translate-y-0.5 transition-all"
              data-testid="telegram-test-btn"
            >
              📤 رسالة اختبار
            </button>
          )}
        </div>

        {msg && (
          <div className="bg-[#252932] rounded-xl p-3 text-sm text-white mb-4" data-testid="telegram-msg">
            {msg}
          </div>
        )}

        <div>
          <p className="text-sm text-[#A0AEC0] mb-2">الحسابات المربوطة ({status?.count || 0}):</p>
          {status?.linked?.length ? (
            <div className="space-y-2">
              {status.linked.map((c) => (
                <div key={c.chat_id} className="flex items-center justify-between bg-[#0F1115] rounded-xl px-3 py-2">
                  <div>
                    <div className="text-white font-bold text-sm">
                      {c.first_name || "User"} {c.username && <span className="text-[#A0AEC0]">@{c.username}</span>}
                    </div>
                    <div className="text-xs text-[#718096]" dir="ltr">ID: {c.chat_id}</div>
                  </div>
                  <button
                    onClick={() => unlink(c.chat_id)}
                    className="bg-[#FF4B72]/10 text-[#FF4B72] rounded-lg p-2 hover:bg-[#FF4B72]/20"
                    data-testid={`unlink-${c.chat_id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#718096] text-sm">لا توجد حسابات مربوطة بعد.</p>
          )}
        </div>
      </div>

      <InstallPWAGuide />
    </div>
  );
}

function InstallPWAGuide() {
  return (
    <div className="bg-gradient-to-br from-[#1A1D24] to-[#252932] rounded-2xl p-6 border border-[#00E5FF]/30">
      <h3 className="text-lg font-bold text-white mb-2">📱 ثبّت لوحة التحكم كتطبيق على آيفونك</h3>
      <ol className="list-decimal list-inside space-y-1 text-sm text-[#A0AEC0]">
        <li>افتح هذا الموقع في <b className="text-white">Safari</b> على آيفونك</li>
        <li>اضغط زر <b className="text-white">المشاركة</b> (المربع مع السهم لأعلى) ⬆️</li>
        <li>اختر <b className="text-white">"Add to Home Screen"</b> أو "إضافة إلى الشاشة الرئيسية"</li>
        <li>راح يظهر كأيقونة على شاشتك تفتح مثل التطبيق تماماً</li>
      </ol>
      <p className="text-xs text-[#FFDE00] mt-3">
        💡 مع إشعارات تيليجرام، راح يصلك تنبيه فوري لكل طلب — أحسن من تطبيق iOS عادي!
      </p>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      await onLogin(email, password);
    } catch (e) {
      setErr(e.response?.data?.detail || "بيانات خاطئة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <form onSubmit={submit} className="bg-[#1A1D24] rounded-3xl p-8 border border-[#2D3748]" data-testid="admin-login-form">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FFDE00] mb-3">
            <ShieldCheck size={32} className="text-[#0F1115]" />
          </div>
          <h2 className="text-2xl font-black text-white">دخول الأدمن</h2>
          <p className="text-[#A0AEC0] text-sm">للوصول إلى لوحة التحكم</p>
        </div>
        <div className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#FFDE00] outline-none"
            dir="ltr"
            data-testid="admin-email-input"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة السر"
            className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#FFDE00] outline-none"
            dir="ltr"
            data-testid="admin-password-input"
          />
          {err && <p className="text-[#FF4B72] text-sm" data-testid="admin-login-error">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FFDE00] text-[#0F1115] font-bold rounded-xl px-6 py-3 hover:-translate-y-0.5 transition-all disabled:opacity-60"
            data-testid="admin-login-submit"
          >
            {loading ? "..." : "دخول"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductsAdmin({ headers }) {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // product object or "new"

  const refresh = () => axios.get(`${API}/products`).then((r) => setProducts(r.data));
  useEffect(() => { refresh(); }, []);

  const remove = async (id) => {
    if (!window.confirm("حذف المنتج؟")) return;
    await axios.delete(`${API}/products/${id}`, { headers: headers() });
    refresh();
  };

  return (
    <div data-testid="products-admin">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">المنتجات ({products.length})</h2>
        <button
          onClick={() => setEditing("new")}
          className="bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-4 py-2 flex items-center gap-2 hover:-translate-y-0.5 transition-all"
          data-testid="add-product-btn"
        >
          <Plus size={16} /> إضافة منتج
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="bg-[#1A1D24] rounded-2xl p-4 border border-[#2D3748]" data-testid={`admin-product-${p.id}`}>
            <div className="aspect-video bg-[#252932] rounded-xl overflow-hidden mb-3">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white truncate">{p.name}</h3>
              <span className="text-[#FFDE00] font-black">{p.price} ر.س</span>
            </div>
            <p className="text-xs text-[#A0AEC0] mb-3">
              {categoryLabel(p.category)} · مخزون {p.stock} · {p.is_tradeable ? "قابل للتداول" : "غير قابل"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(p)}
                className="flex-1 bg-[#252932] text-white rounded-lg py-2 flex items-center justify-center gap-1 hover:bg-[#2D3748]"
                data-testid={`edit-product-${p.id}`}
              >
                <Edit size={14} /> تعديل
              </button>
              <button
                onClick={() => remove(p.id)}
                className="bg-[#FF4B72]/10 text-[#FF4B72] rounded-lg px-3 hover:bg-[#FF4B72]/20"
                data-testid={`delete-product-${p.id}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          headers={headers}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, headers, onClose, onSaved }) {
  const [form, setForm] = useState(
    product || { name: "", description: "", price: 0, image: "", category: "adopt_me", stock: 1, is_tradeable: true }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) return setErr("الصورة كبيرة (3MB كحد أقصى)");
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, image: reader.result });
    reader.readAsDataURL(f);
  };

  const save = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.name || !form.image || !form.price) return setErr("الاسم والصورة والسعر مطلوبة");
    setSaving(true);
    try {
      if (product) {
        await axios.put(`${API}/products/${product.id}`, form, { headers: headers() });
      } else {
        await axios.post(`${API}/products`, form, { headers: headers() });
      }
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.detail || "خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F1115]/85 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1A1D24] rounded-3xl w-full max-w-lg p-6 border border-[#2D3748] max-h-[90vh] overflow-y-auto"
        data-testid="product-editor"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">{product ? "تعديل منتج" : "منتج جديد"}</h3>
          <button type="button" onClick={onClose} className="text-[#A0AEC0]" data-testid="close-editor-btn">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="الاسم">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
              data-testid="editor-name-input"
            />
          </Field>
          <Field label="الوصف">
            <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows="2"
              className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
              data-testid="editor-description-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="السعر (ر.س)">
              <input type="number" step="0.01" value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
                data-testid="editor-price-input"
              />
            </Field>
            <Field label="المخزون">
              <input type="number" value={form.stock}
                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
                data-testid="editor-stock-input"
              />
            </Field>
          </div>
          <Field label="القسم">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
              data-testid="editor-category-select"
            >
              {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="رابط الصورة أو ارفع ملف">
            <input value={form.image?.startsWith("data:") ? "" : form.image}
              onChange={(e) => setForm({ ...form, image: e.target.value })}
              placeholder="https://..."
              dir="ltr"
              className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF] text-start mb-2"
              data-testid="editor-image-url-input"
            />
            <label className="block w-full border-2 border-dashed border-[#2D3748] rounded-xl p-3 text-center cursor-pointer hover:border-[#00E5FF]">
              <Upload className="inline text-[#00E5FF]" size={18} />
              <span className="text-sm text-white ms-1">رفع ملف</span>
              <input type="file" accept="image/*" onChange={onFile} className="hidden" data-testid="editor-image-file-input" />
            </label>
            {form.image && (
              <img src={form.image} alt="preview" className="mt-2 max-h-32 rounded-lg" />
            )}
          </Field>
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_tradeable}
              onChange={(e) => setForm({ ...form, is_tradeable: e.target.checked })}
              className="w-4 h-4 accent-[#00E5FF]"
              data-testid="editor-tradeable-checkbox"
            />
            متاح في قسم التداول
          </label>
          {err && <p className="text-[#FF4B72] text-sm">{err}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-4 py-3 hover:-translate-y-0.5 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            data-testid="editor-save-btn"
          >
            <Save size={16} /> {saving ? "..." : "حفظ"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-[#A0AEC0] mb-1">{label}</label>
      {children}
    </div>
  );
}

function OrdersAdmin({ headers }) {
  const [orders, setOrders] = useState([]);
  const refresh = () => axios.get(`${API}/orders`, { headers: headers() }).then((r) => setOrders(r.data));
  useEffect(() => { refresh(); }, []);

  const setStatus = async (id, status) => {
    await axios.put(`${API}/orders/${id}/status`, { status }, { headers: headers() });
    refresh();
  };
  const remove = async (id) => {
    if (!window.confirm("حذف الطلب؟")) return;
    await axios.delete(`${API}/orders/${id}`, { headers: headers() });
    refresh();
  };

  return (
    <div data-testid="orders-admin">
      <h2 className="text-xl font-bold text-white mb-4">الطلبات ({orders.length})</h2>
      {orders.length === 0 ? (
        <div className="text-center py-10 text-[#A0AEC0]">لا توجد طلبات بعد.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-[#1A1D24] rounded-2xl p-4 border border-[#2D3748]" data-testid={`order-${o.id}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-white">{o.product_name}</h3>
                  <p className="text-xs text-[#A0AEC0]">{o.buyer_name} · {o.product_price} ر.س</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              {(o.user_email || o.user_phone || o.user_auth_type) && (
                <div className="bg-[#00E5FF]/5 border border-[#00E5FF]/20 rounded-xl p-2 mb-2 space-y-0.5">
                  <div className="text-[10px] text-[#00E5FF] font-bold">بيانات الحساب المسجّل</div>
                  {o.user_email && (
                    <div className="text-xs text-white flex items-center gap-1" dir="ltr">
                      <span className="text-[#A0AEC0] text-[10px]">EMAIL:</span> {o.user_email}
                    </div>
                  )}
                  {o.user_phone && (
                    <div className="text-xs text-white flex items-center gap-1" dir="ltr">
                      <span className="text-[#A0AEC0] text-[10px]">PHONE:</span> {o.user_phone}
                    </div>
                  )}
                  {o.user_auth_type && (
                    <div className="text-[10px] text-[#A0AEC0]">
                      نوع الحساب: {o.user_auth_type === "google" ? "Google" : o.user_auth_type === "phone" ? "رقم جوال" : "ضيف"}
                    </div>
                  )}
                </div>
              )}
              {o.buyer_contact && <p className="text-xs text-[#A0AEC0] mb-1">تواصل: {o.buyer_contact}</p>}
              {o.notes && <p className="text-xs text-[#A0AEC0] mb-2">ملاحظات: {o.notes}</p>}
              <a href={o.receipt_image} target="_blank" rel="noreferrer" className="block">
                <img src={o.receipt_image} alt="receipt" className="w-full max-h-40 object-contain bg-[#0F1115] rounded-xl mb-3" />
              </a>
              <div className="flex gap-2">
                <button onClick={() => setStatus(o.id, "approved")}
                  className="flex-1 bg-[#00E5FF]/15 text-[#00E5FF] rounded-lg py-2 text-sm font-bold hover:bg-[#00E5FF]/25"
                  data-testid={`approve-order-${o.id}`}
                ><Check size={14} className="inline ms-1" /> قبول</button>
                <button onClick={() => setStatus(o.id, "rejected")}
                  className="flex-1 bg-[#FF4B72]/15 text-[#FF4B72] rounded-lg py-2 text-sm font-bold hover:bg-[#FF4B72]/25"
                  data-testid={`reject-order-${o.id}`}
                ><X size={14} className="inline ms-1" /> رفض</button>
                <button onClick={() => remove(o.id)} className="bg-[#252932] text-[#A0AEC0] rounded-lg px-3 hover:bg-[#2D3748]">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: "قيد الانتظار", c: "#FFDE00" },
    approved: { label: "مقبول", c: "#00E5FF" },
    rejected: { label: "مرفوض", c: "#FF4B72" },
  };
  const s = map[status] || map.pending;
  return (
    <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: s.c + "20", color: s.c }}>
      {s.label}
    </span>
  );
}

function BankAdmin({ headers }) {
  const [info, setInfo] = useState({ bank_name: "", account_name: "", account_number: "", iban: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API}/bank-info`).then((r) => setInfo(r.data));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await axios.put(`${API}/bank-info`, info, { headers: headers() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-lg bg-[#1A1D24] rounded-2xl p-6 border border-[#2D3748] space-y-3" data-testid="bank-admin">
      <h2 className="text-xl font-bold text-white mb-2">بيانات التحويل البنكي</h2>
      <Field label="اسم البنك">
        <input value={info.bank_name} onChange={(e) => setInfo({ ...info, bank_name: e.target.value })}
          className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
          data-testid="bank-name-input"
        />
      </Field>
      <Field label="اسم صاحب الحساب">
        <input value={info.account_name} onChange={(e) => setInfo({ ...info, account_name: e.target.value })}
          className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
          data-testid="account-name-input"
        />
      </Field>
      <Field label="رقم الحساب">
        <input value={info.account_number} onChange={(e) => setInfo({ ...info, account_number: e.target.value })}
          dir="ltr"
          className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF] text-start"
          data-testid="account-number-input"
        />
      </Field>
      <Field label="IBAN">
        <input value={info.iban} onChange={(e) => setInfo({ ...info, iban: e.target.value })}
          dir="ltr"
          className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF] text-start"
          data-testid="iban-input"
        />
      </Field>
      <Field label="ملاحظات للمشتري">
        <textarea value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} rows="2"
          className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-3 py-2 text-white outline-none focus:border-[#00E5FF]"
          data-testid="bank-notes-input"
        />
      </Field>
      <button type="submit" disabled={saving}
        className="w-full bg-[#FFDE00] text-[#0F1115] font-bold rounded-xl px-4 py-3 hover:-translate-y-0.5 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        data-testid="save-bank-btn"
      >
        <Save size={16} /> {saving ? "..." : saved ? "تم الحفظ ✓" : "حفظ"}
      </button>
    </form>
  );
}

function TradesAdmin({ headers }) {
  const [trades, setTrades] = useState([]);
  const refresh = () => axios.get(`${API}/trades?status=all`).then((r) => setTrades(r.data));
  useEffect(() => { refresh(); }, []);
  const remove = async (id) => {
    if (!window.confirm("حذف التداول؟")) return;
    await axios.delete(`${API}/admin/trades/${id}`, { headers: headers() });
    refresh();
  };
  return (
    <div data-testid="trades-admin">
      <h2 className="text-xl font-bold text-white mb-4">التداولات ({trades.length})</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {trades.map((t) => (
          <div key={t.id} className="bg-[#1A1D24] rounded-2xl p-4 border border-[#2D3748]">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-white">{t.title}</h3>
                <p className="text-xs text-[#A0AEC0]">من: {t.creator_name} · حالة: {t.status}</p>
                {t.matched_with_name && <p className="text-xs text-[#00E5FF]">مع: {t.matched_with_name}</p>}
              </div>
              <button onClick={() => remove(t.id)} className="bg-[#FF4B72]/10 text-[#FF4B72] rounded-lg p-2" data-testid={`admin-delete-trade-${t.id}`}>
                <Trash2 size={14} />
              </button>
            </div>
            {t.contact && <p className="text-xs text-[#A0AEC0]">تواصل: {t.contact}</p>}
          </div>
        ))}
        {trades.length === 0 && <p className="text-[#A0AEC0]">لا توجد تداولات.</p>}
      </div>
    </div>
  );
}
