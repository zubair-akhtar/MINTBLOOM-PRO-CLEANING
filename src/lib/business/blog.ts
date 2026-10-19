// @polsia:user-owned — typed editorial content for the public Mintbloom journal.

export type BlogBodyBlock =
  | { id: string; type: 'heading'; text: string; level: 2 | 3 }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'list'; items: string[] };

export type BlogFeaturedImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  published: boolean;
  publishedAt: string;
  author: string;
  city?: string;
  featuredImage?: BlogFeaturedImage;
  body: BlogBodyBlock[];
};

// This starter record is deliberately labeled as sample content until Mintbloom
// supplies final editorial copy, author details, and any approved imagery.
export const blogPosts: BlogPost[] = [
  {
    slug: 'sample-planning-a-smoother-home-cleaning-visit',
    title: 'Sample guide: Planning a smoother home cleaning visit',
    excerpt:
      'Sample editorial copy for the Mintbloom Pro journal. Replace this starter guide with approved cleaning-market content before publishing it as final advice.',
    published: true,
    publishedAt: '2026-10-03',
    author: 'Mintbloom Pro',
    city: 'Lubbock, Texas',
    body: [
      {
        id: 'intro',
        type: 'paragraph',
        text: 'This sample article shows how Mintbloom Pro can share practical, location-aware cleaning guidance without promising a service scope that has not been reviewed. Use it as the editorial starting point for the journal.',
      },
      {
        id: 'before-you-book',
        type: 'heading',
        text: 'Before you book, make the scope easy to understand',
        level: 2,
      },
      {
        id: 'before-you-book-copy',
        type: 'paragraph',
        text: 'A clear service request gives a cleaning team a better view of the home, the rooms that matter most, and any details that may change the next step. Note the address, the type of cleaning you want, and any specialty or travel considerations up front.',
      },
      {
        id: 'helpful-details',
        type: 'list',
        items: [
          'Name the rooms or areas that should be included.',
          'Call out move-in, move-out, turnover, or specialty needs.',
          'Mention access details and anything that could affect timing.',
        ],
      },
      {
        id: 'review-the-next-step',
        type: 'heading',
        text: 'Review the next step before work begins',
        level: 2,
      },
      {
        id: 'review-the-next-step-copy',
        type: 'paragraph',
        text: 'For approved residential services, Mintbloom Pro presents the available scope and calculated total in the booking flow. Work that is deep, commercial, specialty, or otherwise variable can be reviewed for a quote instead.',
      },
      {
        id: 'replace-before-publishing',
        type: 'heading',
        text: 'Replace this sample before publishing final advice',
        level: 3,
      },
      {
        id: 'replace-before-publishing-copy',
        type: 'paragraph',
        text: 'This starter record is a template for future city-targeted posts. Replace its copy, date, author, and optional image with approved editorial details while keeping its unique slug and structured body blocks.',
      },
    ],
  },
];

export function getPublishedBlogPosts(): BlogPost[] {
  return blogPosts
    .filter((post) => post.published)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export function getPublishedBlogPost(slug: string): BlogPost | undefined {
  return getPublishedBlogPosts().find((post) => post.slug === slug);
}
