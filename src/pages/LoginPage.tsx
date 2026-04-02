import { useState } from "react";
import { loginUser, registerUser, confirmUser, resendConfirmationCode } from "../services/cognito";
import { validatePassword } from "../utils/passwordValidator";

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handleLogin = async () => {
    try {
      if (!email.trim() || !password.trim()) {
        alert("Email and password are required.");
        return;
      }

      const token = await loginUser(email.trim(), password);
      localStorage.setItem("idToken", token as string);

      onLogin();
      alert("Login successful!");
    } catch (error) {
      console.error(error);
      alert("Login failed. Check credentials or complete required action.");
    }
  };

  const handlePasswordChange = (newPassword: string) => {
    setPassword(newPassword);
    if (isRegistering) {
      const validation = validatePassword(newPassword);
      setPasswordErrors(validation.errors);
    }
  };

  const handleRegister = async () => {
    try {
      if (!email.trim() || !password.trim()) {
        alert("Email and password are required to register.");
        return;
      }

      const validation = validatePassword(password);
      if (!validation.isValid) {
        alert(`Password requirements not met:\n• ${validation.errors.join("\n• ")}`);
        return;
      }

      // Use email as both username and preferred_username
      await registerUser(email.trim(), password, email.trim(), email.trim());
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
      if (!email.trim() || !verificationCode.trim()) {
        alert("Email and verification code are required.");
        return;
      }

      // Use email as the username
      await confirmUser(email.trim(), verificationCode.trim());
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
      if (!email.trim()) {
        alert("Email is required to resend code.");
        return;
      }
      // Use email as the username
      await resendConfirmationCode(email.trim());
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

  const passwordValidation = isRegistering ? validatePassword(password) : null;

  return (
    <div style={{ padding: "40px", maxWidth: "400px" }}>
      <h2>{isRegistering ? "Register" : "Login"}</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => handlePasswordChange(e.target.value)}
      />
      <br />
      {isRegistering && passwordValidation && (
        <div style={{ marginTop: "10px", fontSize: "14px" }}>
          {passwordValidation.isValid ? (
            <div style={{ color: "green" }}>✓ Password meets requirements</div>
          ) : (
            <div style={{ color: "#ff6b6b" }}>
              <strong>Password requirements:</strong>
              <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                {passwordValidation.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <br />
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