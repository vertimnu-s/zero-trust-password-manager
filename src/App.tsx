import { useState, useCallback, useEffect, useRef } from "react";
import LoginPage from "./pages/LoginPage";
import VaultPage from "./pages/VaultPage";
import ProfilePage from "./pages/ProfilePage";
import Layout from "./components/layout/Layout";

export type Page = 'vault' | 'profile';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('vault');
  const lastActivityRef = useRef<number>(0);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("idToken");
    setLoggedIn(false);
    setCurrentPage('vault');
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!loggedIn) return;

    const checkToken = () => {
      const token = localStorage.getItem("idToken");
      if (!token) {
        handleLogout();
        return;
      }
      const expiry = getTokenExpiry(token);
      if (expiry && Date.now() >= expiry) {
        handleLogout();
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 30000);
    return () => clearInterval(interval);
  }, [loggedIn, handleLogout]);

  useEffect(() => {
    if (!loggedIn) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = () => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_TIMEOUT_MS) {
        handleLogout();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'mousemove'] as const;
    events.forEach(e => window.addEventListener(e, resetActivity));
    const interval = setInterval(checkInactivity, 30000);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity));
      clearInterval(interval);
    };
  }, [loggedIn, handleLogout]);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout}>
      {currentPage === 'vault' && <VaultPage />}
      {currentPage === 'profile' && <ProfilePage />}
    </Layout>
  );
}

export default App;