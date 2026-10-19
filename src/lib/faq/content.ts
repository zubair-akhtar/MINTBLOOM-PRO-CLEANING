// @polsia:user-owned — FAQ content AND its shape. Edit the questions/answers and
// the CTA below. You may also EXTEND these types (e.g. add a `category` field) to
// support a richer layout — the sealed <FaqJsonLd> only reads `question` +
// `answer`, so extending FaqItem is safe. This is your content file.

export interface FaqItem {
  /** Stable identifier used by the accordion. */
  id: string;
  /** Shown in the accordion AND emitted as the JSON-LD Question name. */
  question: string;
  /** Shown in the accordion AND emitted as the JSON-LD Answer text. Plain text. */
  answer: string;
}

/** Call-to-action under the FAQ. Set the content's `cta` to null to hide it. */
export interface FaqCta {
  label: string;
  href: string;
}

export interface FaqContent {
  /** Optional intro paragraph under the H1. */
  intro?: string;
  /** The question/answer pairs — rendered in the accordion AND as FAQPage JSON-LD. */
  items: FaqItem[];
  /** The CTA under the list, or `null` for a CTA-free FAQ page. */
  cta: FaqCta | null;
}

export const faqContent: FaqContent = {
  intro: 'Clear answers about scope, products, pricing, scheduling, and care for your home.',
  items: [
    {
      id: 're-clean-guarantee',
      question: 'What happens if I need a re-clean?',
      answer:
        'If something in the agreed scope needs attention, contact Mintbloom so we can review the visit and discuss a re-clean. The response is tied to the agreed scope and the condition we can verify; we do not publish a blanket guarantee window here.',
    },
    {
      id: 'eco-products',
      question: 'Do you use eco-friendly products?',
      answer:
        'Product selection is based on the surface, soil, and requested sanitation level. Mintbloom does not claim every product is eco-certified, non-toxic, biodegradable, kid-safe, or pet-safe; share a product preference when booking so the scope can be reviewed.',
    },
    {
      id: 'flat-rate-pricing',
      question: 'How does pricing work?',
      answer:
        'Basic Cleaning starts at $185. Other published amounts are starting prices only. We review condition, size, safety, specialty materials, travel, and requested add-ons before confirming final pricing.',
    },
    {
      id: 'scheduling',
      question: 'How does scheduling work?',
      answer:
        'Submit your service type, preferred date, cadence when applicable, and property details through the request form. We will review the request and contact you; a preferred date is not a confirmed booking.',
    },
    {
      id: 'insurance',
      question: 'Is Mintbloom insured?',
      answer:
        'Mintbloom Pro LLC is fully registered, bonded, and insured with general liability coverage. Mintbloom does not publish a coverage amount here or claim additional coverage that has not been confirmed.',
    },
  ],
  cta: { label: 'Request a quote', href: '/book' },
};
