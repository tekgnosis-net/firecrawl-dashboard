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

const REPO_URL = 'https://github.com/tekgnosis-net/firecrawl-dashboard';

const SIDEBAR_DARK = '#1C1C1E';
const SIDEBAR_BORDER = '#38383A';
const SIDEBAR_MUTED = '#98989D';

function GitHubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

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

      {/* Settings + controls */}
      <div style={{ padding: '8px', borderTop: `1px solid ${SIDEBAR_BORDER}`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <NavLink to="/settings" style={navStyle} title={sidebarCollapsed ? 'Settings' : undefined}>
          <span style={{ fontSize: '16px', flexShrink: 0, lineHeight: 1 }}>⚙️</span>
          {!sidebarCollapsed && 'Settings'}
        </NavLink>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={sidebarCollapsed ? 'GitHub — Star us!' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'transparent', color: SIDEBAR_MUTED, textDecoration: 'none', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', transition: 'color 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
          onMouseLeave={e => e.currentTarget.style.color = SIDEBAR_MUTED}
        >
          <GitHubIcon size={16} />
          {!sidebarCollapsed && <span>GitHub <span style={{ fontSize: '11px', opacity: 0.6 }}>⭐ Star us!</span></span>}
        </a>
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

      {/* Footer */}
      {!sidebarCollapsed && (
        <div style={{ padding: '8px 12px 12px', fontSize: '10px', color: '#636366', textAlign: 'center', lineHeight: 1.4 }}>
          Built with ❤️ by <a href="https://tekgnosis.net" target="_blank" rel="noopener noreferrer" style={{ color: '#636366', textDecoration: 'none', borderBottom: '1px dotted #636366' }}>Tekgnosis</a>
        </div>
      )}
    </aside>
  );
}
