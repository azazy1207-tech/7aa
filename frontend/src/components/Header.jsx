import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import AuthModal from "./AuthModal";
import { LogOut, ShoppingBag, Repeat, ShieldCheck, Menu, X } from "lucide-react";

export default function Header() {
  const { user, logout, admin } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const nav = [
    { to: "/", label: "المتجر", icon: ShoppingBag, testid: "nav-store" },
    { to: "/trades", label: "التداول", icon: Repeat, testid: "nav-trades" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0F1115]/80 backdrop-blur-xl border-b border-[#2D3748]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E5FF] to-[#FFDE00] flex items-center justify-center text-xl font-black text-[#0F1115] group-hover:rotate-6 transition-transform">
              R
            </div>
            <div className="hidden sm:block">
              <div className="font-black text-white text-lg leading-tight">RBX SHOP</div>
              <div className="text-[10px] text-[#A0AEC0] -mt-1">متجر روبلوكس</div>
            </div>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-2">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-testid={item.testid}
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                    active
                      ? "bg-[#00E5FF]/10 text-[#00E5FF]"
                      : "text-[#A0AEC0] hover:text-white hover:bg-[#252932]"
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-semibold">{item.label}</span>
                </Link>
              );
            })}
            {admin && (
              <Link
                to="/admin"
                data-testid="nav-admin"
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                  location.pathname.startsWith("/admin")
                    ? "bg-[#FFDE00]/10 text-[#FFDE00]"
                    : "text-[#A0AEC0] hover:text-white hover:bg-[#252932]"
                }`}
              >
                <ShieldCheck size={18} />
                <span className="font-semibold">لوحة التحكم</span>
              </Link>
            )}
          </nav>

          {/* User */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3" data-testid="user-info">
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-9 h-9 rounded-full border-2 border-[#00E5FF]" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#252932] flex items-center justify-center text-white font-bold">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                <div className="hidden sm:block">
                  <div className="text-white text-sm font-semibold leading-tight">{user.name}</div>
                  <div className="text-[10px] text-[#A0AEC0]">
                    {user.auth_type === "google" ? "Google" : user.auth_type === "phone" ? "جوال" : "ضيف"}
                  </div>
                </div>
                <button
                  onClick={() => { logout(); navigate("/"); }}
                  className="text-[#A0AEC0] hover:text-[#FF4B72] p-2 rounded-lg transition-colors"
                  data-testid="logout-btn"
                  title="خروج"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="bg-[#00E5FF] text-[#0F1115] font-bold rounded-xl px-5 py-2 hover:-translate-y-0.5 transition-all"
                data-testid="open-auth-btn"
              >
                تسجيل الدخول
              </button>
            )}

            <button
              className="md:hidden text-white p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="mobile-menu-btn"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-[#2D3748] bg-[#0F1115]">
            <div className="px-4 py-3 space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-white rounded-xl hover:bg-[#252932]"
                    data-testid={`mobile-${item.testid}`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {admin && (
                <Link
                  to="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-[#FFDE00] rounded-xl hover:bg-[#252932]"
                >
                  <ShieldCheck size={18} />
                  <span>لوحة التحكم</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
