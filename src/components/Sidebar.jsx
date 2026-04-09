// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { useStore } from '../store';

const NAV_ITEMS = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { to: '/crawl', icon: '🕸️', label: 'Crawl' },
  { to: '/scrape', icon: '📄', label: 'Scrape' },
  { to: '/search', icon: '🔍', label: 'Search' },
  { to: '/map', icon: '🗺️', label: 'Map' },
];

const SIDEBAR_DARK = '#1C1C1E';
const SIDEBAR_BORDER = '#38383A';
const SIDEBAR_MUTED = '#98989D';

const THEME_ICONS = { auto: '◐', light: '☀', dark: '☾' };
const THEME_LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };
const THEME_CYCLE = { auto: 'light', light: 'dark', dark: 'auto' };

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, theme, setTheme } = useStore();
  const w = sidebarCollapsed ? '60px' : '220px';

  const navStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    background: isActive ? '#0071E3' : 'transparent',
    color: isActive ? '#FFFFFF' : SIDEBAR_MUTED,
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: isActive ? '500' : '400',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    transition: 'background 0.15s',
  });

  return (
    <aside style={{
      width: w, minWidth: w,
      background: SIDEBAR_DARK,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      overflow: 'hidden',
      transition: 'width 0.2s ease, min-width 0.2s ease',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 12px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: `1px solid ${SIDEBAR_BORDER}`, marginBottom: '6px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, #ff6b35, #e63946)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>🔥</div>
        {!sidebarCollapsed && <span style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '15px' }}>Firecrawl</span>}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(({ to, icon, label, end }) => (
          <NavLink key={to} to={to} end={end} style={navStyle} title={sidebarCollapsed ? label : undefined}>
            <span style={{ fontSize: '16px', flexShrink: 0, lineHeight: 1 }}>{icon}</span>
            {!sidebarCollapsed && label}
          </NavLink>
        ))}
      </nav>

      {/* Settings + collapse */}
      <div style={{ padding: '8px', borderTop: `1px solid ${SIDEBAR_BORDER}`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <NavLink to="/settings" style={navStyle} title={sidebarCollapsed ? 'Settings' : undefined}>
          <span style={{ fontSize: '16px', flexShrink: 0, lineHeight: 1 }}>⚙️</span>
          {!sidebarCollapsed && 'Settings'}
        </NavLink>
        <button
          onClick={() => setTheme(THEME_CYCLE[theme])}
          title={`Theme: ${THEME_LABELS[theme]}`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'transparent', border: 'none', color: SIDEBAR_MUTED, cursor: 'pointer', fontSize: '13px', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
          <span style={{ fontSize: '14px', flexShrink: 0, lineHeight: 1 }}>{THEME_ICONS[theme]}</span>
          {!sidebarCollapsed && THEME_LABELS[theme]}
        </button>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'transparent', border: 'none', color: SIDEBAR_MUTED, cursor: 'pointer', fontSize: '13px', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
          <span style={{ fontSize: '13px', flexShrink: 0 }}>{sidebarCollapsed ? '▶' : '◀'}</span>
          {!sidebarCollapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
