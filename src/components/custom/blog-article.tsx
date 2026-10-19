// @polsia:user-owned — reusable public blog article presentation.

import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { BlogPost } from '@/lib/business/blog';

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function BlogArticle({ post }: { post: BlogPost }) {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page flex flex-col gap-12 py-section-lg sm:gap-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <Button asChild variant="ghost" className="-ml-3 w-fit gap-2 text-muted-foreground">
            <Link href="/blog">
              <ArrowLeft className="size-4" aria-hidden />
              Back to the journal
            </Link>
          </Button>
          <header className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
              {post.city ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                  <MapPin className="size-3.5" aria-hidden />
                  {post.city}
                </span>
              ) : null}
              <span>{post.author}</span>
              <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
            </div>
            <h1 className="max-w-4xl font-display text-display tracking-tight text-foreground">
              {post.title}
            </h1>
            <p className="max-w-3xl text-body-lg text-muted-foreground">{post.excerpt}</p>
          </header>
          {post.featuredImage ? (
            <figure className="overflow-hidden rounded-2xl border border-border/80 bg-muted shadow-sm">
              <Image
                src={post.featuredImage.src}
                alt={post.featuredImage.alt}
                width={post.featuredImage.width}
                height={post.featuredImage.height}
                sizes="(min-width: 1024px) 66rem, 100vw"
                className="h-auto w-full object-cover"
              />
            </figure>
          ) : null}
        </div>

        <article className="mx-auto flex w-full max-w-3xl flex-col gap-7 text-body leading-relaxed text-foreground">
          {post.body.map((block) => {
            if (block.type === 'heading') {
              const Heading = block.level === 3 ? 'h3' : 'h2';
              return (
                <Heading
                  key={block.id}
                  className={`pt-5 font-display leading-tight ${block.level === 3 ? 'text-h3' : 'text-h2'}`}
                >
                  {block.text}
                </Heading>
              );
            }

            if (block.type === 'list') {
              return (
                <ul
                  key={block.id}
                  className="flex list-disc flex-col gap-3 pl-6 marker:text-primary"
                >
                  {block.items.map((item) => (
                    <li key={`${block.id}-${item}`}>{item}</li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={block.id} className="text-body-lg text-foreground/85">
                {block.text}
              </p>
            );
          })}
        </article>

        <aside className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-primary/15 bg-brand-50/45 p-6 dark:bg-brand-900/10 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-h3 text-foreground">
              Ready to review your cleaning scope?
            </h2>
            <p className="text-small text-muted-foreground">
              Start with Mintbloom Pro’s booking flow for approved residential work.
            </p>
          </div>
          <Button asChild className="w-full shrink-0 gap-2 sm:w-auto">
            <Link href="/book">
              Request a quote <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}
