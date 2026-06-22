import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { CATEGORIES } from "@/lib/categories";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, Package } from "lucide-react";

const GAME_INFO = {
  adopt_me: {
    label: "Adopt Me 🐾",
    accent: "#FF4B72",
    bg: "from-[#FF4B72]/20 via-[#1A1D24] to-[#1A1D24]",
    description: "حيوانات أليفة، بيوض، ركوب طائر",
  },
  grow_garden: {
    label: "Grow a Garden 🌱",
    accent: "#22C55E",
    bg: "from-[#22C55E]/20 via-[#1A1D24] to-[#1A1D24]",
    description: "محاصيل، بذور نادرة، أدوات",
  },
  steal_brainrot: {
    label: "Steal a Brainrot 🧠",
    accent: "#FFDE00",
    bg: "from-[#FFDE00]/20 via-[#1A1D24] to-[#1A1D24]",
    description: "شخصيات، عناصر سرقة، تطويرات",
  },
};

export default function CatalogPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/products`)
      .then((r) => setProducts(r.data))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const filtered = products.filter((p) =>
      p.name.toLowerCase().includes(q.toLowerCase())
    );
    const g = {};
    for (const c of CATEGORIES) {
      if (c.id === "all") continue;
      g[c.id] = filtered.filter((p) => p.category === c.id);
    }
    return g;
  }, [products, q]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="catalog-page">
      {/* Hero */}
      <section className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-bl from-[#1A1D24] via-[#1A1D24] to-[#252932] border border-[#2D3748] p-6 md:p-10">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-[#00E5FF]/10 blur-3xl"></div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-[#FFDE00]/10 text-[#FFDE00] px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <Sparkles size={16} />
            لوحة العناصر
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-2">
            كل المنتجات في <span className="gradient-text">مكان واحد</span>
          </h1>
          <p className="text-[#A0AEC0]">تصفّح كل الحيوانات والعناصر مرتبة حسب اللعبة</p>
        </div>
      </section>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096]" size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في كل المنتجات..."
          className="w-full bg-[#1A1D24] border border-[#2D3748] rounded-2xl pe-12 ps-4 py-3 text-white focus:border-[#00E5FF] outline-none"
          data-testid="catalog-search-input"
        />
      </div>

      {loading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#1A1D24] rounded-3xl h-64 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([catId, items]) => {
            const info = GAME_INFO[catId] || { label: catId, accent: "#00E5FF", bg: "from-[#1A1D24] to-[#1A1D24]", description: "" };
            if (items.length === 0) return null;
            return (
              <section
                key={catId}
                className={`rounded-3xl bg-gradient-to-bl ${info.bg} border border-[#2D3748] p-5 md:p-6`}
                data-testid={`game-section-${catId}`}
              >
                <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-white">{info.label}</h2>
                    {info.description && <p className="text-sm text-[#A0AEC0] mt-1">{info.description}</p>}
                  </div>
                  <div
                    className="text-xs font-bold px-3 py-1.5 rounded-xl"
                    style={{ background: info.accent + "20", color: info.accent }}
                  >
                    {items.length} عنصر
                  </div>
                </div>

                {/* Roblox-inventory style grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/product/${p.id}`)}
                      className="group bg-[#0F1115]/80 rounded-2xl p-2 border-2 border-[#2D3748] hover:border-[var(--accent)] hover:-translate-y-1 transition-all backdrop-blur-sm"
                      style={{ "--accent": info.accent }}
                      data-testid={`catalog-item-${p.id}`}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-[#252932] relative mb-2">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        {p.stock <= 0 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[10px] text-white bg-[#FF4B72] px-2 py-0.5 rounded">نفد</span>
                          </div>
                        )}
                      </div>
                      <div className="text-white text-xs font-bold truncate text-center mb-0.5">{p.name}</div>
                      <div className="text-center text-[11px] font-black" style={{ color: info.accent }}>
                        {p.price} ر.س
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Empty state */}
          {Object.values(grouped).every((arr) => arr.length === 0) && (
            <div className="text-center py-16 text-[#A0AEC0] bg-[#1A1D24] rounded-3xl border border-[#2D3748]" data-testid="catalog-empty">
              <Package size={48} className="mx-auto text-[#718096] mb-3" />
              <p>لا توجد منتجات مطابقة لبحثك</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
