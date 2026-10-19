// @polsia:framework-owned — DO NOT EDIT. The one SEO piece this module governs.
//
// Render <FaqJsonLd items={faqContent.items} /> once on the FAQ page (or any page
// that lists the same Q&A). It emits a <script type="application/ld+json"> whose
// FAQPage schema is built from the items you pass, so the structured data always
// matches the answers you render. KEEP THIS ELEMENT ON THE PAGE when you restyle —
// it is what earns the FAQ rich result.

// Minimal input contract: anything with a question + answer. Deliberately
// decoupled from the user-owned FaqItem shape, so extending FaqItem in
// src/lib/faq/content.ts never breaks the schema.
type FaqJsonLdItem = { question: string; answer: string };

export function FaqJsonLd({ items }: { items: readonly FaqJsonLdItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
  // Escape raw-text terminators before putting JSON in the script element. Rendering
  // it as a text child keeps the template compatible with the customer's Biome gate
  // without using unsafe HTML injection.
  const jsonLd = JSON.stringify(schema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  // A type="application/ld+json" block is DATA, not an executable script, so the
  // template's strict CSP script-src does not apply and it needs no nonce.
  return <script type="application/ld+json">{jsonLd}</script>;
}
