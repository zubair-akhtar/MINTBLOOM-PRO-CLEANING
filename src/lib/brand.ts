// @polsia:user-owned — brand identity. Edit freely. `site.ts` re-exports
// siteName/siteDescription; `manifest.ts` + `opengraph-image.tsx` read `brandVisual`.

export const siteName = 'Mintbloom';
export const siteDescription =
  'Mintbloom Pro brings clear-scope residential and specialty cleaning across Texas, with starting prices where supported and customized quotes after human review.';

// PWA + social-share colors. HEX only (the oklch() tokens in globals.css aren't
// readable here) — set to match your brand seed.
export const brandVisual = {
  /** PWA browser-UI / status-bar color. */
  themeColor: '#1d7a4f',
  /** PWA splash + install background. */
  backgroundColor: '#f6f9f4',
  /** Social-share (OG/Twitter) image. */
  og: {
    background: '#0e1611',
    foreground: '#f0f5ec',
    /** Second line under the site name; '' hides it. */
    tagline:
      'Clear-scope cleaning across Texas, with starting prices where supported and customized quotes after human review.',
  },
} as const;
