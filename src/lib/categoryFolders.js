export const CATEGORY_FOLDERS = {
  cast: {
    id: 'cast',
    title: 'Cast',
    param: 'movieCast',
    optionsKey: 'castOptions',
    valuesFor: (bookmark) => bookmark.casts ?? [],
  },
  studio: {
    id: 'studio',
    title: 'Studio',
    param: 'movieStudio',
    optionsKey: 'studioOptions',
    valuesFor: (bookmark) => (bookmark.studio ? [bookmark.studio] : []),
  },
  genre: {
    id: 'genre',
    title: 'Genre',
    param: 'movieGenre',
    optionsKey: 'genreOptions',
    valuesFor: (bookmark) => bookmark.genres ?? [],
  },
};

export function getActiveCategoryFilter(searchParams) {
  for (const folder of Object.values(CATEGORY_FOLDERS)) {
    const value = String(searchParams.get(folder.param) || '').trim();
    if (value) return { folder, value };
  }
  return null;
}

export function countAssignedValues(library, folder) {
  const counts = new Map();
  for (const bookmark of library || []) {
    if (bookmark.is_archived) continue;
    const source = String(bookmark.source_slug || 'x').trim().toLowerCase() || 'x';
    for (const rawValue of folder.valuesFor(bookmark)) {
      const name = String(rawValue || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const current = counts.get(key) || { name, count: 0, sources: new Map() };
      current.count += 1;
      current.sources.set(source, (current.sources.get(source) || 0) + 1);
      counts.set(key, current);
    }
  }
  return counts;
}

export function buildFolderValues(library, catalog, folder) {
  const assigned = countAssignedValues(library, folder);
  const merged = new Map();
  const options = catalog?.[folder.optionsKey] ?? [];

  for (const option of options) {
    const name = String(option.name || '').trim();
    if (!name) continue;
    const assignedCount = assigned.get(name.toLowerCase());
    const key = `${option.group_id ?? ''}::${name.toLowerCase()}`;
    merged.set(key, {
      ...option,
      name,
      count: Number(assignedCount?.count ?? 0),
      sources: assignedCount?.sources ?? new Map(),
    });
  }

  for (const item of assigned.values()) {
    const hasOption = [...merged.values()].some((option) => option.name.toLowerCase() === item.name.toLowerCase());
    if (!hasOption) {
      merged.set(`assigned::${item.name.toLowerCase()}`, item);
    }
  }

  return [...merged.values()].sort((a, b) => (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  ));
}

export function getFolderTotals(library, catalog, folderId) {
  const folder = CATEGORY_FOLDERS[folderId];
  if (!folder) return { tags: 0, assigned: 0 };
  const values = buildFolderValues(library, catalog, folder);
  return {
    tags: values.length,
    assigned: values.reduce((sum, item) => sum + Number(item.count || 0), 0),
  };
}

export function formatSourceCounts(sources, catalog) {
  if (!sources?.size) return '';
  return [...sources.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([slug, count]) => {
      const source = catalog?.sources?.find((item) => item.slug === slug);
      return `${source?.display_name || slug}: ${count}`;
    })
    .join(' · ');
}
