// @polsia:user-owned — app navigation rendered by SiteNav/SiteFooter and read by
// the sitemap. Edit it as pages are added or removed.
// This list is a convenience, not module registration.

export type NavGroup = 'primary' | 'secondary' | 'footer';

export interface NavItem {
  /** Visible link text. */
  label: string;
  /** App route, e.g. '/' or '/dashboard'. */
  href: string;
  /** Where it renders: top-nav 'primary'/'secondary', or 'footer'. */
  group: NavGroup;
  /** Group `primary` items into a dropdown: items sharing a `menu` value collapse
   *  into one "<menu> ⌄" top-bar slot (e.g. `menu: 'Resources'` on Blog/Docs/
   *  Changelog). Keeps the bar short. Ignored for 'secondary'/'footer'. */
  menu?: string;
  /** When true, render only if a session exists (see site-nav.tsx). */
  requiresAuth?: boolean;
  /** Sort key within a group (ascending); unordered items fall to the end. */
  order?: number;
}

// Keep the bar short: ~3-5 primary slots, group the tail with `menu`, push the
// rest to 'footer' (SiteNav overflows extras into a "More" dropdown). Example:
//   { label: 'Pricing', href: '/pricing', group: 'primary' },
//   { label: 'Blog',    href: '/blog',    group: 'primary', menu: 'Resources' },
//   { label: 'Docs',    href: '/docs',    group: 'primary', menu: 'Resources' },
//   { label: 'Sign in', href: '/login',   group: 'secondary' },
export const navItems: NavItem[] = [
  { label: 'Plans', href: '/#plans', group: 'primary', order: 0 },
  { label: 'How it works', href: '/#how', group: 'primary', order: 1 },
  { label: 'FAQ', href: '/faq', group: 'primary', order: 2 },
  { label: 'Manage service', href: '/manage', group: 'primary', requiresAuth: true, order: 3 },
  {
    label: 'Specialty cleaning',
    href: '/specialty-cleaning',
    group: 'primary',
    menu: 'Project cleaning',
    order: 4,
  },
  {
    label: 'Builders & developers',
    href: '/builders',
    group: 'primary',
    menu: 'Project cleaning',
    order: 5,
  },
  { label: 'Request a quote', href: '/book', group: 'secondary', order: 0 },
  { label: 'Careers', href: '/careers', group: 'footer', order: 0 },
  { label: 'Contact', href: '/areas#request-area', group: 'footer', order: 1 },
  { label: 'Service areas', href: '/areas', group: 'footer', order: 2 },
  { label: 'Blog', href: '/blog', group: 'footer', order: 3 },
];
