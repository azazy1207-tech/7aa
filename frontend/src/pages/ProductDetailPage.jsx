import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/context/AuthContext";
import { categoryLabel } from "@/lib/categories";
import { Upload, CheckCircle2, ArrowRight, Copy, Check } from "lucide-react";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, authHeaders } = useAuth();
  const [product, setProduct] = useState(null);
  const [bank, setBank] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState(""); // base64
  const [receiptPreview, setReceiptPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    axios.get(`${API}/products/${id}`).then((r) => setProduct(r.data)).catch(() => setProduct(null));
    axios.get(`${API}/bank-info`).then((r) => setBank(r.data));
  }, [id]);

  // Auto-fill buyer name from logged-in user
  useEffect(() => {
    if (user && !name) {
      setName(user.name || "");
      if (user.phone) setContact(user.phone);
      else if (user.email) setContact(user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    // Compress + resize image to max 1600px on long side, JPEG quality 0.85
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.85);
        setReceipt(compressed);
        setReceiptPreview(compressed);
      };
      img.onerror = () => setErr("تعذّر قراءة الصورة، جرّب صورة أخرى");
      img.src = ev.target.result;
    };
    reader.onerror = () => setErr("تعذّر قراءة الملف");
    reader.readAsDataURL(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr("الرجاء إدخال اسمك");
    if (!receipt) return setErr("الرجاء رفع صورة الإيصال");
    setSubmitting(true);
    setErr("");
    try {
      await axios.post(`${API}/orders`, {
        product_id: product.id,
        buyer_name: name.trim(),
        buyer_contact: contact.trim(),
        receipt_image: receipt,
        notes: notes.trim(),
      }, { headers: authHeaders() });
      setDone(true);
    } catch (ex) {
      const detail = ex.response?.data?.detail;
      if (typeof detail === "string") {
        setErr(detail);
      } else if (ex.code === "ERR_NETWORK") {
        setErr("تعذّر الاتصال بالخادم، تحقق من الإنترنت وحاول مجدداً");
      } else if (ex.response?.status === 413) {
        setErr("صورة الإيصال كبيرة جداً، استخدم صورة أصغر");
      } else {
        setErr(`خطأ: ${ex.message || "حاول مجدداً"}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  };

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-[#A0AEC0]">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center" data-testid="order-success">
        <div className="bg-[#1A1D24] rounded-3xl p-10 border border-[#00E5FF]/40">
          <CheckCircle2 className="mx-auto text-[#00E5FF] mb-4" size={64} />
          <h2 className="text-3xl font-black text-white mb-2">تم استلام طلبك! 🎉</h2>
          <p className="text-[#A0AEC0] mb-6">سيتم التحقق من إيصالك وتسليم المنتج قريباً عبر ديسكورد/واتساب.</p>
          <button
            onClick={() => navigate("/")}
            className="bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-6 py-3 hover:-translate-y-0.5 transition-all"
            data-testid="back-home-btn"
          >
            العودة للمتجر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="product-detail-page">
      <button
        onClick={() => navigate(-1)}
        className="text-[#A0AEC0] hover:text-white mb-4 flex items-center gap-1 text-sm"
        data-testid="back-btn"
      >
        <ArrowRight size={16} />
        رجوع
      </button>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image side */}
        <div className="bg-[#1A1D24] rounded-3xl p-6 border border-[#2D3748]">
          <div className="aspect-square rounded-2xl overflow-hidden bg-[#252932] mb-4">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="inline-block bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-bold px-3 py-1 rounded-lg mb-2">
            {categoryLabel(product.category)}
          </div>
          <h1 className="text-3xl font-black text-white mb-2">{product.name}</h1>
          <p className="text-[#A0AEC0] mb-4">{product.description}</p>
          <div className="flex items-baseline gap-2">
            <div className="text-[#FFDE00] text-4xl font-black">{product.price}</div>
            <div className="text-[#A0AEC0]">ريال سعودي</div>
          </div>
          <div className="mt-3 text-sm text-[#A0AEC0]">
            المتوفر: <span className="text-white font-bold">{product.stock}</span>
          </div>
        </div>

        {/* Form side */}
        <div className="space-y-6">
          {/* Bank info */}
          <div className="bg-gradient-to-br from-[#1A1D24] to-[#252932] rounded-3xl p-6 border border-[#FFDE00]/30">
            <h2 className="text-xl font-bold text-white mb-1">معلومات التحويل البنكي</h2>
            <p className="text-sm text-[#A0AEC0] mb-4">حوّل المبلغ ثم أرفق صورة الإيصال</p>
            <div className="space-y-2 text-sm">
              {bank?.bank_name && (
                <Row label="البنك" value={bank.bank_name} onCopy={() => copy(bank.bank_name, "bn")} copied={copied === "bn"} />
              )}
              {bank?.account_name && (
                <Row label="اسم الحساب" value={bank.account_name} onCopy={() => copy(bank.account_name, "an")} copied={copied === "an"} />
              )}
              {bank?.account_number && (
                <Row label="رقم الحساب" value={bank.account_number} onCopy={() => copy(bank.account_number, "acc")} copied={copied === "acc"} mono />
              )}
              {bank?.iban && (
                <Row label="IBAN" value={bank.iban} onCopy={() => copy(bank.iban, "ib")} copied={copied === "ib"} mono />
              )}
            </div>
            {bank?.notes && <p className="text-xs text-[#FFDE00] mt-3">📌 {bank.notes}</p>}
          </div>

          {/* Order form */}
          <form onSubmit={submit} className="bg-[#1A1D24] rounded-3xl p-6 border border-[#2D3748] space-y-4" data-testid="order-form">
            <h2 className="text-xl font-bold text-white">إتمام الشراء</h2>

            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">اسم المحول *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك الكامل كما في التحويل"
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none"
                data-testid="buyer-name-input"
              />
            </div>

            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">طريقة التواصل (اختياري)</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Discord / WhatsApp / Roblox username"
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none"
                data-testid="buyer-contact-input"
              />
            </div>

            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">صورة الإيصال *</label>
              <label className="w-full border-2 border-dashed border-[#2D3748] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#00E5FF] hover:bg-[#00E5FF]/5 transition-all">
                {receiptPreview ? (
                  <img src={receiptPreview} alt="receipt" className="max-h-48 rounded-xl" />
                ) : (
                  <>
                    <Upload className="text-[#00E5FF] mb-2" size={32} />
                    <p className="text-white text-sm">اضغط لرفع صورة الإيصال</p>
                    <p className="text-xs text-[#718096] mt-1">PNG / JPG حتى 5MB</p>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                  data-testid="receipt-upload-input"
                />
              </label>
            </div>

            <div>
              <label className="block text-sm text-[#A0AEC0] mb-2">ملاحظات (اختياري)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="2"
                className="w-full bg-[#0F1115] border border-[#2D3748] rounded-xl px-4 py-3 text-white focus:border-[#00E5FF] outline-none resize-none"
                data-testid="order-notes-input"
              />
            </div>

            {err && <p className="text-[#FF4B72] text-sm" data-testid="order-error">{err}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-6 py-4 hover:-translate-y-0.5 transition-all disabled:opacity-60 text-lg"
              data-testid="submit-order-btn"
            >
              {submitting ? "جاري الإرسال..." : `تأكيد الطلب — ${product.price} ر.س`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, onCopy, copied, mono }) {
  return (
    <div className="flex items-center justify-between bg-[#0F1115] rounded-xl px-3 py-2 border border-[#2D3748]">
      <div className="text-[#A0AEC0] text-xs">{label}</div>
      <div className="flex items-center gap-2">
        <span className={`text-white text-sm ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : "rtl"}>{value}</span>
        <button type="button" onClick={onCopy} className="text-[#00E5FF] hover:text-white">
          {copied ? <Check size={16} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

