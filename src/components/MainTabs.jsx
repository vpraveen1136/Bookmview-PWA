import { NavLink } from 'react-router-dom';

export function MainTabs() {
  return (
    <nav className="main-tabs" aria-label="Primary">
      <NavLink to="/dashboard" className={({ isActive }) => `main-tab${isActive ? ' is-active' : ''}`}>
        Dashboard
      </NavLink>
      <NavLink to="/library" className={({ isActive }) => `main-tab${isActive ? ' is-active' : ''}`}>
        Library
      </NavLink>
    </nav>
  );
}
