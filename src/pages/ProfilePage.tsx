import { useState } from 'react';
import { useToast } from '../components/ui/useToast';
import { changePassword, globalSignOutUser } from '../services/cognito';
import { validatePassword } from '../utils/passwordValidator';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import PasswordStrength from '../components/ui/PasswordStrength';
import { Lock, LogOut } from 'lucide-react';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Profile</h1>

      <Card className={styles.section}>
        <div className={styles.sectionHeader}>
          <Lock size={20} />
          <h2>Change Login Password</h2>
        </div>
        <p className={styles.description}>
          This changes your Cognito login password. Your vault encryption master password is separate and managed within the vault.
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
    </div>
  );
}
