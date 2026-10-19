// @polsia:user-owned — reusable public blog index card.

import { ArrowUpRight, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import type { BlogPost } from '@/lib/business/blog';

function formatPublishedDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function BlogPostCard({ post }: { post: BlogPost }) {
  return (
    <Card className="group flex h-full overflow-hidden border-border/80 bg-card/90 transition-colors hover:border-primary/35">
      <Link
        href={`/blog/${post.slug}`}
        className="flex h-full flex-col rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {post.featuredImage ? (
          <div className="overflow-hidden border-b border-border/80 bg-muted">
            <Image
              src={post.featuredImage.src}
              alt={post.featuredImage.alt}
              width={post.featuredImage.width}
              height={post.featuredImage.height}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          </div>
        ) : null}
        <div className="flex flex-1 flex-col gap-5 p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-muted-foreground">
            {post.city ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <MapPin className="size-3.5" aria-hidden />
                {post.city}
              </span>
            ) : null}
            <span>{post.author}</span>
            <time dateTime={post.publishedAt}>{formatPublishedDate(post.publishedAt)}</time>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <h2 className="font-display text-h3 tracking-tight text-foreground transition-colors group-hover:text-primary">
              {post.title}
            </h2>
            <p className="text-body text-muted-foreground">{post.excerpt}</p>
          </div>
          <span className="inline-flex items-center gap-2 text-small font-semibold text-primary">
            Read the guide
            <ArrowUpRight
              className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </span>
        </div>
      </Link>
    </Card>
  );
}
