import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const { processGoogleSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const session_id = params.get("session_id");
    if (!session_id) {
      navigate("/", { replace: true });
      return;
    }
    (async () => {
      try {
        await processGoogleSession(session_id);
        // Clear hash and go home
        window.history.replaceState(null, "", "/");
        navigate("/", { replace: true });
      } catch (e) {
        setError("فشل تسجيل الدخول");
        setTimeout(() => navigate("/", { replace: true }), 1500);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1115]">
      <div className="text-center" data-testid="auth-callback">
        <div className="w-16 h-16 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg">{error || "جاري تسجيل الدخول..."}</p>
      </div>
    </div>
  );
}
