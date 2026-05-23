import { useMemo, useRef, useState, useEffect } from 'react';
import { useToast } from '../components/ui/useToast';
import QRCode from 'react-qr-code';
import { changePassword, globalSignOutUser, deleteAccount, setUpMFA, verifyMFAToken, disableMFA, checkMFAStatus, userPool } from '../services/cognito';
import { validatePassword } from '../utils/passwordValidator';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import PasswordStrength from '../components/ui/PasswordStrength';
import { Lock, LogOut, Trash2, Smartphone } from 'lucide-react';
import styles from './ProfilePage.module.css';

const MFA_ISSUER = 'Zero Trust Vault';

export default function ProfilePage() {
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  const accessTokenRef = useRef<string | null>(null);
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaSecretCode, setMfaSecretCode] = useState<string | null>(null);
  const [mfaUsername, setMfaUsername] = useState<string | null>(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const otpAuthUri = useMemo(() => {
    if (!mfaSecretCode) return null;
    const label = mfaUsername ? `${MFA_ISSUER}:${mfaUsername}` : MFA_ISSUER;
    const encodedLabel = encodeURIComponent(label);
    const encodedIssuer = encodeURIComponent(MFA_ISSUER);
    return `otpauth://totp/${encodedLabel}?secret=${mfaSecretCode}&issuer=${encodedIssuer}&digits=6&period=30`;
  }, [mfaSecretCode, mfaUsername]);

  useEffect(() => {
    const initializeMFAStatus = async () => {

      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) return;

      try {
        const status = await checkMFAStatus();
        setMfaEnabled(status);
      } catch (error) {
        console.error('Failed to check MFA status:', error);
        setMfaEnabled(false);
      }
    };

    initializeMFAStatus();
  }, []);


  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount();
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Failed to delete account: ${message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    setSigningOut(true);
    try {
      await globalSignOutUser();
      addToast('Signed out from all devices. Please log in again.', 'success');
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Failed to sign out everywhere: ${message}`, 'error');
    } finally {
      setSigningOut(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('All fields are required', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('New passwords do not match', 'error');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      addToast('New password does not meet requirements', 'error');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      addToast('Login password changed successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast(`Failed to change password: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartMFASetup = async () => {
  setMfaLoading(true);
  try {
    const result = await setUpMFA();
    accessTokenRef.current = result.accessToken;

    const normalizedSecret = result.secretCode.replace(/\s+/g, '').toUpperCase();
    setMfaSecretCode(normalizedSecret);
    setShowMFASetup(true);
    addToast('Add this account to your authenticator app using the code below', 'info');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addToast(`Failed to set up MFA: ${message}`, 'error');
  } finally {
    setMfaLoading(false);
  }
};

const handleVerifyMFA = async () => {
  if (!mfaVerificationCode.trim()) {
    addToast('Verification code is required', 'error');
    return;
  }

  if (!accessTokenRef.current) {
    addToast('MFA setup session expired. Please start again.', 'error');
    return;
  }

  setMfaLoading(true);
  try {
    await verifyMFAToken(accessTokenRef.current, mfaVerificationCode.trim());

    setMfaEnabled(true);
    setShowMFASetup(false);
    setMfaSecretCode(null);
    setMfaVerificationCode('');
    accessTokenRef.current = null;

    addToast('MFA enabled successfully!', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addToast(`Failed to verify MFA: ${message}`, 'error');
  } finally {
    setMfaLoading(false);
  }
};

const handleDisableMFA = async () => {
  setMfaLoading(true);
  try {
    await disableMFA();

    setMfaEnabled(false);
    setShowMFASetup(false);
    setMfaSecretCode(null);
    setMfaVerificationCode('');
    accessTokenRef.current = null;

    addToast('MFA disabled successfully', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addToast(`Failed to disable MFA: ${message}`, 'error');
  } finally {
    setMfaLoading(false);
  }
};

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Profile</h1>

      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <Lock size={20} />
          <h2>Change Login Password</h2>
        </div>
        <p className={styles.description}>
          This changes your Cognito login password. It does not affect the encryption of your stored vault items.
        </p>
        <div className={styles.form}>
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
          {newPassword && <PasswordStrength password={newPassword} />}
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
          <Button onClick={handleChangePassword} loading={loading} fullWidth>
            Change Password
          </Button>
        </div>
      </Card>

      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <Smartphone size={20} />
          <h2>Multi-Factor Authentication (MFA)</h2>
        </div>
        <p className={styles.description}>
          Enhance your account security with multi-factor authentication. You'll need to enter a code from your authenticator app during login.
        </p>
        {!mfaEnabled && !showMFASetup ? (
          <Button onClick={handleStartMFASetup} loading={mfaLoading} fullWidth>
            Enable MFA
          </Button>
        ) : mfaEnabled && !showMFASetup ? (
          <>
            <p className={styles.mfaEnabled}>✓ MFA is enabled</p>
            <Button onClick={handleDisableMFA} loading={mfaLoading} variant="danger" fullWidth>
              Disable MFA
            </Button>
          </>
                ) : showMFASetup && mfaSecretCode ? (
          <div className={styles.mfaSetup}>
            <p className={styles.mfaSetupInstructions}>
              1. Open your authenticator app (e.g., Google Authenticator, Authy)<br/>
              2. Scan this code or enter it manually:
            </p>
            {otpAuthUri && (
              <div className={styles.qrCode}>
                <QRCode value={otpAuthUri} size={180} />
              </div>
            )}
            <code className={styles.secretCode}>{mfaSecretCode}</code>
            <p className={styles.mfaSetupInstructions}>
              3. Enter the 6-digit code from your app:
            </p>
            <Input
              label="Verification Code"
              type="text"
              value={mfaVerificationCode}
              onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
            />
            <div className={styles.mfaActions}>
              <Button onClick={handleVerifyMFA} loading={mfaLoading} fullWidth>
                Verify & Enable MFA
              </Button>
                            <Button
                              onClick={() => { setShowMFASetup(false); setMfaSecretCode(null); setMfaUsername(null); setMfaVerificationCode(''); }}
                              variant="ghost"
                              fullWidth
                            >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <LogOut size={20} />
          <h2>Session Management</h2>
        </div>
        <p className={styles.description}>
          Revoke all active sessions across every device. You will need to log in again everywhere.
        </p>
        <Button onClick={handleSignOutEverywhere} loading={signingOut} variant="danger" fullWidth>
          Sign Out Everywhere
        </Button>
      </Card>

      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <Trash2 size={20} />
          <h2>Delete Account</h2>
        </div>
        <p className={styles.description}>
          Permanently delete your account and all vault data. This action cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <Button onClick={() => setShowDeleteConfirm(true)} variant="danger" fullWidth>
            Delete My Account
          </Button>
        ) : (
          <div className={styles.deleteConfirm}>
            <p className={styles.deleteWarning}>
              This will permanently delete your account, including all stored passwords, cards, identities, and notes. Type <strong>DELETE</strong> to confirm.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
            />
            <div className={styles.deleteActions}>
              <Button
                onClick={handleDeleteAccount}
                loading={deleting}
                variant="danger"
                disabled={deleteConfirmText !== 'DELETE'}
              >
                Permanently Delete Account
              </Button>
              <Button variant="ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
