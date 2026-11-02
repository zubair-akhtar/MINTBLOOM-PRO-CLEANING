// @polsia:user-owned — shared presentation for the public legal pages.

import Link from 'next/link';

interface LegalPageProps {
  readonly title: string;
  readonly introduction: string;
  readonly sourceText: string;
  readonly documentPath: '/terms' | '/privacy';
  readonly crossLink: {
    readonly href: '/terms' | '/privacy';
    readonly label: string;
  };
}

function sourceBlocks(sourceText: string): string[] {
  const content = sourceText.endsWith('\n') ? sourceText.slice(0, -1) : sourceText;
  return content.split('\n\n');
}

function isBulletBlock(block: string): boolean {
  return block.split('\n').every((line) => line.startsWith('- '));
}

function SourceParagraph({ block }: { readonly block: string }) {
  const lines = block.split('\n');
  return (
    <p data-legal-block className="mt-4 text-base leading-7 text-foreground">
      {lines.map((line, lineIndex) => (
        <span key={line}>
          {line}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  );
}

export function LegalPage({
  title,
  introduction,
  sourceText,
  documentPath,
  crossLink,
}: LegalPageProps) {
  const blocks = sourceBlocks(sourceText);

  return (
    <main className="relative isolate min-h-[70vh] bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20 lg:py-24">
        <header className="mb-8 sm:mb-10">
          <p className="text-eyebrow text-primary">Legal · Mintbloomproclean</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-foreground sm:text-display">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{introduction}</p>
          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">Also read </span>
            <Link
              href={crossLink.href}
              className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
            >
              {crossLink.label}
            </Link>
          </p>
        </header>

        <article
          aria-label={`${title} document`}
          data-legal-document={documentPath}
          className="break-words rounded-2xl border border-border bg-card/90 p-5 sm:p-8 lg:p-10"
        >
          {blocks.map((block) => {
            if (block === 'MINTBLOOMPROCLEAN') {
              return (
                <p
                  key={block}
                  data-legal-block
                  className="text-xs font-semibold tracking-[0.16em] text-primary"
                >
                  {block}
                </p>
              );
            }

            if (/^[A-Z][A-Z\s]+$/.test(block)) {
              return (
                <h2
                  key={block}
                  data-legal-block
                  className="mt-3 font-display text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
                >
                  {block}
                </h2>
              );
            }

            if (/^\d+\.\s/.test(block)) {
              return (
                <h3
                  key={block}
                  data-legal-block
                  className="mt-9 border-t border-border pt-6 font-display text-xl font-semibold leading-snug text-foreground sm:mt-10 sm:text-2xl"
                >
                  {block}
                </h3>
              );
            }

            if (isBulletBlock(block)) {
              return (
                <ul
                  key={block}
                  data-legal-block
                  className="mt-4 list-none space-y-2 text-base leading-7 text-foreground"
                >
                  {block.split('\n').map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span aria-hidden="true" className="shrink-0">
                        {'- '}
                      </span>
                      <span data-legal-item>{line.slice(2)}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            return <SourceParagraph key={block} block={block} />;
          })}
        </article>
      </div>
    </main>
  );
}
