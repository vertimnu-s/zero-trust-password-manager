import { useState } from "react";
import LoginPage from "./pages/LoginPage";
import VaultPage from "./pages/VaultPage";

function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  return loggedIn ? (
    <VaultPage />
  ) : (
    <LoginPage onLogin={() => setLoggedIn(true)} />
  );
}

export default App;