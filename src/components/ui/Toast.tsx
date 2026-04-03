import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Toast({ message, type, onClose }: ToastProps) {
  const Icon = icons[type];

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <Icon size={18} className={styles.icon} />
      <span className={styles.message}>{message}</span>
      <button className={styles.close} onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
