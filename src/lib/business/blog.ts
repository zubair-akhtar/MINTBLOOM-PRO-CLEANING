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

export const blogPosts: BlogPost[] = [
  {
    slug: 'lubbock-house-cleaning',
    title: 'House Cleaning in Lubbock, TX: Scope, Scheduling & Pricing',
    excerpt:
      'Looking for house cleaning in Lubbock? Learn what Mintbloom Pro’s residential scope includes, how property details affect an estimate, what the $145 Standard starting rate means before tax, and how to request service.',
    published: true,
    publishedAt: '2026-10-24',
    author: 'Mintbloom Pro',
    city: 'Lubbock, Texas',
    body: [
      {
        id: 'intro',
        type: 'paragraph',
        text: 'Choosing house cleaning in Lubbock starts with two practical details: the service you need and the ZIP code for the property. Mintbloom Pro’s request form collects those details, along with information about the home and your preferred timing, so the requested scope and location can be reviewed. A request does not confirm availability or an appointment.',
      },
      {
        id: 'residential-scope',
        type: 'heading',
        text: 'What to expect from residential house cleaning',
        level: 2,
      },
      {
        id: 'residential-scope-copy',
        type: 'paragraph',
        text: 'Mintbloom Pro’s published Basic Cleaning scope is a routine reset for a lived-in home. It lists kitchen and bathroom surfaces, dusting and vacuuming, and mopping accessible floors. The listed scope does not include inside cabinets or appliances, exterior windows, heavy lifting, or post-construction debris.',
      },
      {
        id: 'basic-cleaning-scope',
        type: 'list',
        items: [
          'Kitchen and bathroom surfaces',
          'Dusting and vacuuming',
          'Mopping accessible floors',
        ],
      },
      {
        id: 'scope-notes',
        type: 'heading',
        text: 'Share the details that shape the request',
        level: 2,
      },
      {
        id: 'scope-notes-copy',
        type: 'paragraph',
        text: 'The request form asks for the property address and ZIP code, home or apartment details, the service type, and notes about the requested scope. Use the notes to explain relevant size, condition, access, or special requirements. Deep cleaning, move-in or move-out work, and other variable scopes may require a customized quote after review.',
      },
      {
        id: 'lubbock-availability',
        type: 'heading',
        text: 'Lubbock availability depends on ZIP code and scope',
        level: 2,
      },
      {
        id: 'lubbock-availability-copy',
        type: 'paragraph',
        text: 'A Lubbock city name by itself does not confirm service availability. The submitted ZIP code is checked against Mintbloom Pro’s approved Lubbock-area coverage, and the requested scope is reviewed as well. Addresses outside the approved Lubbock-area ZIP lists need travel and scope review before a quote. Share the service address so the team can assess the actual request.',
      },
      {
        id: 'scheduling',
        type: 'heading',
        text: 'How scheduling preferences work',
        level: 2,
      },
      {
        id: 'scheduling-copy',
        type: 'paragraph',
        text: 'For recurring residential service, the form accepts a preferred weekly, biweekly, or monthly cadence. It also lets you enter a preferred service date. That date is a preference only: Mintbloom Pro reviews the request and confirms timing afterward. Submitting a date does not reserve or confirm a cleaning appointment.',
      },
      {
        id: 'pricing',
        type: 'heading',
        text: 'Pricing context for house cleaning in Lubbock',
        level: 2,
      },
      {
        id: 'pricing-copy',
        type: 'paragraph',
        text: 'Standard cleaning starts at $145 before market tax. This is a starting rate, not a guaranteed final total. The calculator provides an estimate for supported scopes; size, condition, safety, specialty materials, travel, and requested work can route a request to human review before the final quote.',
      },
      {
        id: 'request',
        type: 'heading',
        text: 'How to request house cleaning in Lubbock',
        level: 2,
      },
      {
        id: 'request-copy',
        type: 'paragraph',
        text: 'Visit the booking form, choose the service you want reviewed, and provide the property address and ZIP code. Add the home details, requested scope, any relevant notes, and a preferred date or recurring cadence if applicable. Include your contact details so Mintbloom Pro can review the request and follow up with next steps. The submission is a service request—not a confirmed booking—and availability depends on the ZIP code and scope.',
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
