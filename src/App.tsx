import { useState, useCallback } from "react";
import LoginPage from "./pages/LoginPage";
import VaultPage from "./pages/VaultPage";
import ProfilePage from "./pages/ProfilePage";
import Layout from "./components/layout/Layout";

export type Page = 'vault' | 'profile';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('vault');

  const handleLogout = useCallback(() => {
    localStorage.removeItem("idToken");
    setLoggedIn(false);
    setCurrentPage('vault');
  }, []);

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