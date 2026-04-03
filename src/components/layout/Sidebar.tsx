import { Shield, KeyRound, User, LogOut } from 'lucide-react';
import type { Page } from '../../App';
import styles from './Sidebar.module.css';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export default function Sidebar({ currentPage, onNavigate, onLogout }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <Shield size={28} className={styles.brandIcon} />
        <span className={styles.brandName}>Zero Trust Vault</span>
      </div>

      <nav className={styles.nav}>
        <button
          className={`${styles.navItem} ${currentPage === 'vault' ? styles.active : ''}`}
          onClick={() => onNavigate('vault')}
        >
          <KeyRound size={20} />
          <span>Vault</span>
        </button>
        <button
          className={`${styles.navItem} ${currentPage === 'profile' ? styles.active : ''}`}
          onClick={() => onNavigate('profile')}
        >
          <User size={20} />
          <span>Profile</span>
        </button>
      </nav>

      <div className={styles.footer}>
        <button className={styles.navItem} onClick={onLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
