import { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import type { Page } from '../../App';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export default function Layout({ children, currentPage, onNavigate, onLogout }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} onLogout={onLogout} />
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
