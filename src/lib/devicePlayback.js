import { getVideoExtensionFromUrl, isAllowedVideoUrl } from './playback.js';

export function isAppleTouchDevice() {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) return true;
  // iPadOS 13+ reports as Mac with touch points.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  if (navigator.userAgentData?.platform === 'macOS' && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Progressive URLs that the current device can decode (e.g. no WebM on iOS). */
export function isPlayableOnDevice(url) {
  if (!isAllowedVideoUrl(url)) return false;
  if (!isAppleTouchDevice()) return true;
  const ext = getVideoExtensionFromUrl(url);
  if (ext === 'webm' || ext === 'ogg') return false;
  return true;
}

export function preferMp4Variants(variants = []) {
  if (!isAppleTouchDevice()) return variants;
  const mp4ish = variants.filter((v) => {
    const ext = getVideoExtensionFromUrl(v?.url);
    return ext === 'mp4' || ext === 'm4v' || ext === 'mov';
  });
  return mp4ish.length ? mp4ish : variants;
}
