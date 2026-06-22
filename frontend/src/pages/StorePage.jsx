import { useEffect, useState } from "react";
import axios from "axios";
import { API, useAuth } from "@/context/AuthContext";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { ShoppingCart, Sparkles, Search, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function StorePage() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/products`, { params: category === "all" ? {} : { category } })
      .then((r) => setProducts(r.data))
      .finally(() => setLoading(false));
  }, [category]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="store-page">
      {/* Hero */}
      <section className="mb-10 relative overflow-hidden rounded-3xl bg-gradient-to-bl from-[#1A1D24] via-[#1A1D24] to-[#252932] border border-[#2D3748] p-8 md:p-12">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-[#00E5FF]/10 blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-[#FFDE00]/10 blur-3xl"></div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-[#00E5FF]/10 text-[#00E5FF] px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Sparkles size={16} />
            متجر روبلوكس الموثوق
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-3">
            بِتات و عناصر <span className="gradient-text">Roblox</span>
          </h1>
          <p className="text-[#A0AEC0] text-lg max-w-2xl">
            اشتري وبَدِّل عناصرك المفضلة من Adopt Me, Grow a Garden, و Steal a Brainrot بأمان وثقة.
          </p>
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096]" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-full bg-[#1A1D24] border border-[#2D3748] rounded-xl pe-12 ps-4 py-3 text-white focus:border-[#00E5FF] outline-none text-start"
            data-testid="search-input"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all ${
                category === c.id
                  ? "bg-[#00E5FF] text-[#0F1115]"
                  : "bg-[#1A1D24] text-[#A0AEC0] hover:text-white border border-[#2D3748]"
              }`}
              data-testid={`filter-${c.id}`}
            >
              <span className="me-1">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#1A1D24] rounded-3xl h-72 animate-pulse"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#A0AEC0]" data-testid="no-products">
          <div className="text-5xl mb-3">📦</div>
          <p>لا توجد منتجات في هذا القسم.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="text-start bg-[#1A1D24] rounded-3xl p-4 border border-[#2D3748] hover:border-[#00E5FF] hover:-translate-y-1 transition-all group flex flex-col"
              data-testid={`product-card-${p.id}`}
            >
              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#252932] relative mb-4">
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                {p.stock <= 0 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="bg-[#FF4B72] text-white px-3 py-1 rounded-lg text-sm font-bold">نفد المخزون</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-[#0F1115]/80 backdrop-blur-md text-[#00E5FF] text-xs font-bold px-2 py-1 rounded-lg">
                  {categoryLabel(p.category)}
                </div>
              </div>
              <h3 className="font-bold text-white text-base mb-1 truncate">{p.name}</h3>
              <p className="text-xs text-[#718096] mb-3 line-clamp-2 min-h-[2rem]">{p.description}</p>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1 text-[#FFDE00] font-black text-lg">
                  <Tag size={16} />
                  {p.price}
                  <span className="text-xs text-[#A0AEC0] font-normal">ر.س</span>
                </div>
                <div className="bg-[#00E5FF]/10 text-[#00E5FF] p-2 rounded-lg group-hover:bg-[#00E5FF] group-hover:text-[#0F1115] transition-colors">
                  <ShoppingCart size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
