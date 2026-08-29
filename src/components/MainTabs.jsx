import { NavLink, useLocation } from 'react-router-dom';

import { useDb } from '../context/DbContext.jsx';

const SOURCE_TABS = [
  { slug: 'x', path: '/x', fallbackLabel: 'X' },
  { slug: 'spankbang', path: '/spankbang', fallbackLabel: 'SPBG' },
];

export function MainTabs() {
  const { catalog } = useDb();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const preservedParams = new URLSearchParams();
  ['search', 'movieCast', 'movieStudio', 'movieGenre', 'refreshSuccess', 'fromFolder'].forEach((key) => {
    const value = params.get(key);
    if (value) preservedParams.set(key, value);
  });
  const preservedSearch = preservedParams.toString();
  const hasCategoryFilter = ['movieCast', 'movieStudio', 'movieGenre'].some((key) => preservedParams.has(key));

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
          to={hasCategoryFilter
            ? `/library?${new URLSearchParams({
              ...Object.fromEntries(preservedParams),
              sources: tab.slug,
              refreshSuccess: preservedParams.get('refreshSuccess') || 'all',
            }).toString()}`
            : `${tab.path}${preservedSearch ? `?${preservedSearch}` : ''}`}
          className={({ isActive }) => {
            const activeByFilter = hasCategoryFilter && params.get('sources') === tab.slug;
            return `main-tab${isActive || activeByFilter ? ' is-active' : ''}`;
          }}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
