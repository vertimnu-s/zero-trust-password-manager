import { useState, useCallback, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import VaultPage from "./pages/VaultPage";
import ProfilePage from "./pages/ProfilePage";
import Layout from "./components/layout/Layout";

export type Page = 'vault' | 'profile';

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

  const handleLogout = useCallback(() => {
    localStorage.removeItem("idToken");
    setLoggedIn(false);
    setCurrentPage('vault');
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