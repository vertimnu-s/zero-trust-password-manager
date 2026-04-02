import { useState } from "react";
import { loginUser, registerUser, confirmUser, resendConfirmationCode } from "../services/cognito";

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [preferredUsername, setPreferredUsername] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const handleLogin = async () => {
    try {
      if (!username.trim() || !password.trim()) {
        alert("Username and password are required.");
        return;
      }

      const token = await loginUser(username.trim(), password);
      localStorage.setItem("idToken", token as string);

      onLogin();
      alert("Login successful!");
    } catch (error) {
      console.error(error);
      alert("Login failed. Check credentials or complete required action.");
    }
  };

  const handleRegister = async () => {
    try {
      if (!username.trim() || !password.trim() || !email.trim() || !preferredUsername.trim()) {
        alert("Username, password, email, and preferred username are required to register.");
        return;
      }

      await registerUser(username.trim(), password, email.trim(), preferredUsername.trim());
      alert("Registration successful. Enter the confirmation code sent by email to finish.");
      setIsConfirming(true);
      setIsRegistering(false);
    } catch (error: unknown) {
      console.error(error);
      const message =
        error && typeof error === "object" && "message" in error && typeof (error as { message: string }).message === "string"
          ? (error as { message: string }).message
          : String(error);
      alert(`Registration failed: ${message}`);
    }
  };

  const handleConfirm = async () => {
    try {
      if (!username.trim() || !verificationCode.trim()) {
        alert("Username and verification code are required.");
        return;
      }

      await confirmUser(username.trim(), verificationCode.trim());
      alert("Account confirmed. You may now log in.");
      setIsConfirming(false);
      setVerificationCode("");
      setIsRegistering(false);
    } catch (error: unknown) {
      console.error(error);
      const message =
        error && typeof error === "object" && "message" in error && typeof (error as { message: string }).message === "string"
          ? (error as { message: string }).message
          : String(error);
      alert(`Confirmation failed: ${message}`);
    }
  };

  const handleResend = async () => {
    try {
      if (!username.trim()) {
        alert("Username is required to resend code.");
        return;
      }
      await resendConfirmationCode(username.trim());
      alert("Confirmation code resent. Check your email.");
    } catch (error: unknown) {
      console.error(error);
      const message =
        error && typeof error === "object" && "message" in error && typeof (error as { message: string }).message === "string"
          ? (error as { message: string }).message
          : String(error);
      alert(`Resend failed: ${message}`);
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>{isRegistering ? "Register" : "Login"}</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br />
      <br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <br />
      {isRegistering && (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <br />
          <br />
          <input
            type="text"
            placeholder="Preferred username (Cognito required)"
            value={preferredUsername}
            onChange={(e) => setPreferredUsername(e.target.value)}
          />
          <br />
          <br />
        </>
      )}
      {isConfirming ? (
        <div>
          <input
            type="text"
            placeholder="Verification Code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
          />
          <br />
          <br />
          <button onClick={handleConfirm} style={{ marginRight: "10px" }}>
            Confirm account
          </button>
          <button onClick={handleResend} style={{ marginRight: "10px" }}>
            Resend code
          </button>
          <button
            onClick={() => {
              setIsConfirming(false);
              setIsRegistering(false);
            }}
          >
            Back to login
          </button>
        </div>
      ) : (
        <div>
          <button onClick={handleLogin} style={{ marginRight: "10px" }}>
            Login
          </button>
          {isRegistering ? (
            <button onClick={handleRegister} style={{ marginRight: "10px" }}>
              Complete registration
            </button>
          ) : (
            <button onClick={() => setIsRegistering(true)} style={{ marginRight: "10px" }}>
              Register
            </button>
          )}
          {isRegistering && (
            <button onClick={() => setIsRegistering(false)}>Cancel</button>
          )}
        </div>
      )}

    </div>
  );
}

export default LoginPage;