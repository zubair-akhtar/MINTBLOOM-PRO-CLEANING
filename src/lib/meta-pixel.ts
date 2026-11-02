// @polsia:user-owned — client-safe Meta Pixel event helper.

export type MetaPixelEvent = 'PageView' | 'Lead' | 'Purchase';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMetaPixelEvent(
  event: MetaPixelEvent,
  parameters?: Record<string, number | string>,
): boolean {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return false;

  if (parameters) {
    window.fbq('track', event, parameters);
  } else {
    window.fbq('track', event);
  }
  return true;
}
