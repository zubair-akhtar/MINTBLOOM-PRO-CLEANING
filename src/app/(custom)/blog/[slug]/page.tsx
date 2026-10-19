// @polsia:user-owned — reusable public Mintbloom journal article route.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogArticle } from '@/components/custom/blog-article';
import { getPublishedBlogPost, getPublishedBlogPosts } from '@/lib/business/blog';

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getPublishedBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPublishedBlogPost(slug);

  if (!post) {
    return {
      title: 'Article not found',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
      authors: [post.author],
      ...(post.featuredImage
        ? {
            images: [
              {
                url: post.featuredImage.src,
                width: post.featuredImage.width,
                height: post.featuredImage.height,
                alt: post.featuredImage.alt,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const post = getPublishedBlogPost(slug);

  if (!post) notFound();

  return <BlogArticle post={post} />;
}
