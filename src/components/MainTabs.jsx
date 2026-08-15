import { NavLink } from 'react-router-dom';

import { useDb } from '../context/DbContext.jsx';

const SOURCE_TABS = [
  { slug: 'x', path: '/x', fallbackLabel: 'X' },
  { slug: 'spankbang', path: '/spankbang', fallbackLabel: 'SPBG' },
];

export function MainTabs() {
  const { catalog } = useDb();

  const tabs = SOURCE_TABS.map((tab) => {
    const fromCatalog = catalog?.sources?.find((s) => s.slug === tab.slug);
    return {
      ...tab,
      label: fromCatalog?.display_name || tab.fallbackLabel,
    };
  });

  return (
    <nav className="main-tabs" aria-label="Sources">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={({ isActive }) => `main-tab${isActive ? ' is-active' : ''}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
