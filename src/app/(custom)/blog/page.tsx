// @polsia:user-owned — public Mintbloom journal index.

import type { Metadata } from 'next';
import { BlogPostCard } from '@/components/custom/blog-post-card';
import { getPublishedBlogPosts } from '@/lib/business/blog';
import { siteDescription, siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Journal',
  description: `Cleaning guidance and service notes from ${siteName}. ${siteDescription}`,
  alternates: { canonical: '/blog' },
};

export default function BlogPage() {
  const posts = getPublishedBlogPosts();

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page flex flex-col gap-10 py-section-lg sm:gap-14">
        <header className="grid gap-5 lg:grid-cols-[1fr_0.8fr] lg:items-end lg:gap-14">
          <div className="flex flex-col gap-4">
            <p className="text-eyebrow text-primary">The Mintbloom journal</p>
            <h1 className="max-w-3xl font-display text-display tracking-tight text-foreground">
              Practical notes for a cleaner home.
            </h1>
          </div>
          <p className="max-w-xl text-body-lg text-muted-foreground lg:justify-self-end">
            Explore cleaning guidance, service notes, and future city-focused resources from
            Mintbloom Pro.
          </p>
        </header>

        {posts.length > 0 ? (
          <section aria-labelledby="journal-posts-heading" className="flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
              <h2 id="journal-posts-heading" className="font-display text-h2 text-foreground">
                Latest from Mintbloom
              </h2>
              <span className="hidden text-small text-muted-foreground sm:inline">
                {posts.length} {posts.length === 1 ? 'published guide' : 'published guides'}
              </span>
            </div>
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              {posts.map((post) => (
                <BlogPostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center sm:p-12">
            <h2 className="font-display text-h3 text-foreground">New guides are on the way.</h2>
            <p className="mx-auto mt-3 max-w-xl text-body text-muted-foreground">
              Mintbloom’s journal does not have any published articles yet. Check back soon for
              practical cleaning guidance.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
