import "@/index.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";
import StorePage from "@/pages/StorePage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import TradesPage from "@/pages/TradesPage";
import TradeRoomPage from "@/pages/TradeRoomPage";
import CatalogPage from "@/pages/CatalogPage";
import AdminPage from "@/pages/AdminPage";
import AuthCallback from "@/pages/AuthCallback";

function AppRouter() {
  const location = useLocation();
  // Process Google auth callback (session_id in URL hash) BEFORE any other route
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <>
      <Header />
      <main className="min-h-screen grain-bg">
        <Routes>
          <Route path="/" element={<StorePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/trades/room/:id" element={<TradeRoomPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      <footer className="border-t border-[#2D3748] py-6 text-center text-xs text-[#718096]">
        RBX SHOP © 2026 · جميع الحقوق محفوظة
      </footer>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
