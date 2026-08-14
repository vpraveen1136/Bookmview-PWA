export const MIN_STREAM_QUALITY_HEIGHT = 480;
export const MAX_RECOMMENDED_STREAM_HEIGHT = 720;
export const LONG_VIDEO_DURATION_MS = 45 * 60 * 1000;
export const VERY_LONG_VIDEO_DURATION_MS = 90 * 60 * 1000;

export function getVariantHeight(variant) {
  const height = Number(variant?.height);
  if (Number.isFinite(height) && height > 0) return height;

  const match = String(variant?.url || '').match(/\/(\d{2,4})x(\d{2,4})\//i);
  if (!match) return 0;

  const parsed = Number(match[2]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function filterStreamQualityVariants(variants = []) {
  return variants.filter((variant) => getVariantHeight(variant) >= MIN_STREAM_QUALITY_HEIGHT);
}

export function pickStreamDefaultVariant(variants = [], durationMs = null) {
  const eligible = filterStreamQualityVariants(variants);
  if (!eligible.length) return variants[0] || null;

  const byHeightAsc = [...eligible].sort(
    (left, right) => getVariantHeight(left) - getVariantHeight(right),
  );
  const inRecommendedBand = byHeightAsc.filter(
    (variant) => getVariantHeight(variant) <= MAX_RECOMMENDED_STREAM_HEIGHT,
  );
  const pool = inRecommendedBand.length ? inRecommendedBand : byHeightAsc;

  const duration = Number(durationMs) || 0;
  if (duration >= VERY_LONG_VIDEO_DURATION_MS) {
    return pool[0];
  }

  if (duration >= LONG_VIDEO_DURATION_MS) {
    return pool.find((variant) => getVariantHeight(variant) === 480) || pool[0];
  }

  return pool.find((variant) => getVariantHeight(variant) === 720) || pool[pool.length - 1];
}

export function formatStreamVariantLabel(variant, durationMs = null) {
  const height = getVariantHeight(variant);
  const base = height > 0 ? `${height}p` : 'Default';
  const duration = Number(durationMs) || 0;

  if (height < MIN_STREAM_QUALITY_HEIGHT) return base;
  if (height > MAX_RECOMMENDED_STREAM_HEIGHT) return `${base} · may buffer`;

  if (duration >= LONG_VIDEO_DURATION_MS && height === 480) {
    return `${base} · recommended`;
  }

  if (duration < LONG_VIDEO_DURATION_MS && height === 720) {
    return `${base} · recommended`;
  }

  return base;
}