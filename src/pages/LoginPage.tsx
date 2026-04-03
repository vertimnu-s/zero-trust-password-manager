import { useState } from "react";
import { loginUser, registerUser, confirmUser, resendConfirmationCode } from "../services/cognito";
import { validatePassword } from "../utils/passwordValidator";
import { useToast } from "../components/ui/useToast";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import PasswordStrength from "../components/ui/PasswordStrength";
import { Shield, Mail, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import styles from "./LoginPage.module.css";

type AuthView = "login" | "register" | "confirm";

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const { addToast } = useToast();
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      addToast("Email and password are required.", "error");
      return;
    }

    setLoading(true);
    try {
      const token = await loginUser(email.trim(), password);
      localStorage.setItem("idToken", token as string);
      addToast("Login successful!", "success");
      onLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Login failed: ${message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      addToast("Email and password are required.", "error");
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      addToast("Password does not meet all requirements.", "error");
      return;
    }

    setLoading(true);
    try {
      await registerUser(email.trim(), password, email.trim(), email.trim());
      addToast("Registration successful! Check your email for the verification code.", "success");
      setView("confirm");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Registration failed: ${message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!email.trim() || !verificationCode.trim()) {
      addToast("Email and verification code are required.", "error");
      return;
    }

    setLoading(true);
    try {
      await confirmUser(email.trim(), verificationCode.trim());
      addToast("Account confirmed! You can now log in.", "success");
      setView("login");
      setVerificationCode("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Confirmation failed: ${message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      addToast("Email is required to resend code.", "error");
      return;
    }
    try {
      await resendConfirmationCode(email.trim());
      addToast("Verification code resent. Check your email.", "info");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Resend failed: ${message}`, "error");
    }
  };

  const handleSubmit = () => {
    if (loading) return;
    if (view === "login") handleLogin();
    else if (view === "register") handleRegister();
    else if (view === "confirm") handleConfirm();
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <Shield size={48} className={styles.icon} />
          <h1 className={styles.title}>Zero Trust Vault</h1>
          <p className={styles.subtitle}>
            {view === "confirm"
              ? "Verify your email address"
              : "Secure password management"}
          </p>
        </div>

        <div className={styles.divider} />

        <div
          className={styles.form}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        >
          {view === "confirm" ? (
            <>
              <Input
                label="Verification Code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter the code from your email"
                icon={<KeyRound size={18} />}
              />
              <Button onClick={handleConfirm} loading={loading} fullWidth>
                Confirm Account
              </Button>
              <div className={styles.actions}>
                <Button variant="ghost" onClick={handleResend} size="sm">
                  Resend Code
                </Button>
                <Button variant="ghost" onClick={() => setView("login")} size="sm">
                  Back to Login
                </Button>
              </div>
            </>
          ) : (
            <>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                icon={<Mail size={18} />}
              />
              <Input
                label="Password"
                type={showPasswordText ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                icon={<Lock size={18} />}
                rightElement={
                  <button
                    type="button"
                    className={styles.eyeButton}
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    tabIndex={-1}
                  >
                    {showPasswordText ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              {view === "register" && password && (
                <PasswordStrength password={password} />
              )}
              <Button
                onClick={view === "login" ? handleLogin : handleRegister}
                loading={loading}
                fullWidth
              >
                {view === "login" ? "Log In" : "Create Account"}
              </Button>
            </>
          )}
        </div>

        {view !== "confirm" && (
          <div className={styles.footer}>
            {view === "login" ? (
              <span>
                Don&apos;t have an account?{" "}
                <button className={styles.link} onClick={() => setView("register")}>
                  Register
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button className={styles.link} onClick={() => setView("login")}>
                  Log in
                </button>
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default LoginPage;