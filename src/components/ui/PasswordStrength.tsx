import { Check, X } from 'lucide-react';
import styles from './PasswordStrength.module.css';

interface PasswordStrengthProps {
  password: string;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const checks = [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special character', met: /[!@#$%^&*()_+\-[\]{}|;:,.<>?]/.test(password) },
  ];

  const metCount = checks.filter(c => c.met).length;
  const strength = (metCount / checks.length) * 100;

  const getStrengthLabel = () => {
    if (strength <= 20) return 'Very Weak';
    if (strength <= 40) return 'Weak';
    if (strength <= 60) return 'Fair';
    if (strength <= 80) return 'Good';
    return 'Strong';
  };

  const getStrengthColor = () => {
    if (strength <= 20) return 'var(--color-danger)';
    if (strength <= 40) return '#e67e22';
    if (strength <= 60) return 'var(--color-warning)';
    if (strength <= 80) return '#6ab04c';
    return 'var(--color-success)';
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${strength}%`, backgroundColor: getStrengthColor() }}
        />
      </div>
      <span className={styles.label} style={{ color: getStrengthColor() }}>
        {getStrengthLabel()}
      </span>
      <ul className={styles.checks}>
        {checks.map((check, i) => (
          <li key={i} className={check.met ? styles.met : styles.unmet}>
            {check.met ? <Check size={14} /> : <X size={14} />}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
