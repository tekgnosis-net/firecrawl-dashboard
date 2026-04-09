// src/components/Layout.jsx
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--apple-bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px', minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
