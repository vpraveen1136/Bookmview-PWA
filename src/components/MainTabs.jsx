import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: '⌂' },
  { path: '/folders', label: 'Folders', icon: '▤' },
  { path: '/favorites', label: 'Favorites', icon: '♡' },
  { path: '/library', label: 'Library', icon: '▣' },
];

export function MainTabs() {
  return (
    <nav className="main-tabs" aria-label="Primary">
      {NAV_ITEMS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) => `main-tab${isActive ? ' is-active' : ''}`}
        >
          <span className="main-tab-icon" aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
