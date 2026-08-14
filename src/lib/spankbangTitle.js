/**
 * SpankBang video page title from URL slug after /video/.
 */

export function spankbangTitleFromVideoPageUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '');
    if (!/spankbang\.com$/i.test(host)) return null;
    const match = parsed.pathname.match(/\/video\/([^/?#]+)/i);
    if (!match) return null;
    let slug = match[1];
    try {
      slug = decodeURIComponent(slug.replace(/\+/g, '%20'));
    } catch {
      slug = slug.replace(/\+/g, ' ');
    }
    slug = String(slug).replace(/\+/g, ' ').trim();
    return slug || null;
  } catch {
    return null;
  }
}

export function isSpankbangInternalUploaderId(value) {
  return /^u[a-z0-9]{4,}$/i.test(String(value || '').trim());
}

export function isHeadlessSourceBookmark(bookmark) {
  const slug = String(bookmark?.source_slug || 'x').trim() || 'x';
  return slug !== 'x';
}

export function getHeadlessBookmarkTitle(bookmark) {
  if (!bookmark) return null;

  const urlCandidates = [
    bookmark.tweet_url,
  ];

  const videoItem = bookmark?.media?.find(
    (item) => item.media_type === 'video' || item.media_type === 'animated_gif',
  );
  if (videoItem?.url) urlCandidates.push(videoItem.url);

  for (const candidate of urlCandidates) {
    const fromUrl = spankbangTitleFromVideoPageUrl(candidate);
    if (fromUrl) return fromUrl;
  }

  const text = String(bookmark?.text || '').trim();
  if (text && !isSpankbangInternalUploaderId(text)) return text;

  return null;
}
