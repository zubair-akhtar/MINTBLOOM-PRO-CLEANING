// @polsia:user-owned — claim-safe, source-backed customer-facing content.
import 'server-only';

import type { SiteContentResponse as SiteContentValues } from '@/lib/contracts/site-content';
import { SiteContentResponse } from '@/lib/contracts/site-content';
import { faqContent } from '@/lib/faq/content';

// Publication checklist: 6+ years of cleaning experience; products selected
// for surface, soil, and requested sanitation level; stronger disinfectants
// such as bleach may be used carefully when appropriate; Mintbloom Pro LLC is
// fully registered, bonded, and insured with general liability coverage.
// Deliberately omitted: theft coverage, licensing, background checks, and
// coverage limits because those were not confirmed for publication.
export const SITE_CONTENT: SiteContentValues = {
  hero: {
    eyebrow: 'Mintbloom Pro LLC · Serving Texas statewide, with variable scopes reviewed',
    title: 'Reliable cleaning, clearly scoped.',
    accent: 'Careful products. No guesswork.',
    description:
      'Residential and specialty cleaning built around dependable service, clear scope, and a human-reviewed customized quote.',
    reassurance:
      '6+ years of cleaning experience · fully registered LLC · bonded and insured with general liability coverage',
  },
  trustPills: [
    { icon: 'shield', label: 'Bonded + insured' },
    { icon: 'badge', label: 'Fully registered LLC' },
    { icon: 'sparkles', label: '6+ years of experience' },
    { icon: 'leaf', label: 'Product choices matched to the surface' },
  ],
  values: [
    {
      eyebrow: 'Continuity',
      title: 'A routine that respects your space.',
      body: 'Tell us about a one-time or recurring residential visit and we will review the right scope with you.',
      bullets: [
        'One-time and recurring residential options',
        'Weekly, biweekly, or monthly cadence',
        'Inclusions and exclusions reviewed before final pricing',
      ],
      icon: 'users',
    },
    {
      eyebrow: 'Transparency',
      title: 'Clear scope, human-reviewed.',
      body: 'Basic Cleaning starts at $185. Every request is reviewed so condition, size, safety, specialty materials, and travel are handled honestly.',
      bullets: [
        'Starting prices where the catalog supports them',
        'No payment collected through the request form',
        'A customized quote after scope review',
      ],
      icon: 'scale',
    },
    {
      eyebrow: 'Product care',
      title: 'Products chosen for the surface.',
      body: 'Surface, soil, and requested sanitation level guide product selection. Stronger disinfectants such as bleach may be used carefully when appropriate; no blanket non-toxic, biodegradable, kid-safe, or pet-safe promise is made.',
      bullets: [
        'Surface-aware product choices',
        'Sanitation level discussed in scope',
        'Specialty materials remain quote-reviewed',
      ],
      icon: 'sprout',
    },
  ],
  steps: [
    {
      number: '01',
      title: 'Choose your service',
      body: 'Start with the service type, property details, and cadence that fit the work you have in mind.',
    },
    {
      number: '02',
      title: 'Review the real scope',
      body: 'Share inclusions, exclusions, add-ons, access, travel, and property notes for human review.',
    },
    {
      number: '03',
      title: 'Request your customized quote',
      body: 'We review the request and contact you. Final pricing is confirmed after the service and property details are reviewed.',
    },
  ],
  faith: {
    eyebrow: 'Faith & values',
    title: 'Work done with purpose, honesty, and care.',
    intro:
      'Mintbloom is founded on Christian faith. We aim to serve our neighbors with diligence, fair dealing, and gratitude—bringing those values into the way we plan, price, and carry out the work.',
    verses: [
      {
        reference: 'Proverbs 16:3',
        text: 'Commit thy works unto the LORD, and thy thoughts shall be established.',
      },
      {
        reference: 'Colossians 3:23–24',
        text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men; Knowing that of the Lord ye shall receive the reward of the inheritance: for ye serve the Lord Christ.',
      },
      {
        reference: 'Deuteronomy 8:18',
        text: 'But thou shalt remember the LORD thy God: for it is he that giveth thee power to get wealth, that he may establish his covenant which he sware unto thy fathers, as it is this day.',
      },
      {
        reference: 'Proverbs 11:1',
        text: 'A false balance is abomination to the LORD: but a just weight is his delight.',
      },
      {
        reference: 'Proverbs 16:8',
        text: 'Better is a little with righteousness than great revenues without right.',
      },
      {
        reference: 'Habakkuk 2:2',
        text: 'And the LORD answered me, and said, Write the vision, and make it plain upon tables, that he may run that readeth it.',
      },
      {
        reference: 'Ecclesiastes 11:6',
        text: 'In the morning sow thy seed, and in the evening withhold not thine hand: for thou knowest not whether shall prosper, either this or that, or whether they both shall be alike good.',
      },
    ],
  },
  plans: [
    {
      name: 'Basic Cleaning',
      audience: 'A single reset for homes and apartments',
      body: 'A clear, no-recurring-commitment visit. Basic Cleaning — Starting at $185; final pricing is confirmed after scope review.',
      priceLabel: 'Basic Cleaning — Starting at $185',
      features: [
        '1–5 bedrooms',
        '1–3 bathrooms in the base matrix',
        'Kitchen, bathroom, surface, and floor care',
        'Optional add-ons reviewed with your request',
      ],
      cta: 'Request a quote',
      emphasis: false,
    },
    {
      name: 'Recurring residential',
      audience: 'A routine you can keep on the calendar',
      body: 'Weekly, biweekly, or monthly residential service across Texas. Location, travel, condition, size, safety, specialty materials, or other variable scopes may require review or a quote.',
      priceLabel: null,
      features: [
        'Starting prices for supported residential scopes',
        '1–5 bedrooms',
        '1–3 bathrooms in the base matrix',
        'Clear visit inclusions and exclusions',
      ],
      cta: 'Request a quote',
      emphasis: true,
    },
    {
      name: 'Specialty scope',
      audience: 'Deep, turnover, commercial, or extended-area work',
      body: 'Some work needs a human scope review because condition, size, safety, specialty materials, or travel changes the time required.',
      priceLabel: null,
      features: [
        'Deep cleaning',
        'Move-in / move-out',
        'Office and commercial work',
        'Extended-area travel review',
      ],
      cta: 'Request a quote',
      emphasis: false,
    },
  ],
  specialty: [
    { icon: 'sparkles', label: 'Deep cleaning with buildup-focused scope' },
    { icon: 'home', label: 'Move-in / move-out detail work' },
    { icon: 'building', label: 'Office and commercial cleaning' },
    { icon: 'map', label: 'Extended-area travel review' },
  ],
  guarantees: [
    {
      icon: 'shield',
      title: 'Registered, bonded, and insured.',
      body: 'Mintbloom Pro LLC carries general liability coverage.',
    },
    {
      icon: 'sparkles',
      title: '6+ years of experience.',
      body: 'Cleaning experience informs residential and specialty-scope conversations.',
    },
    {
      icon: 'leaf',
      title: 'Surface-aware products.',
      body: 'The surface, soil, and requested sanitation level guide product selection.',
    },
    {
      icon: 'scale',
      title: 'A quote when the variables matter.',
      body: 'Condition, size, quantity beyond a cap, safety, specialty materials, and travel are named when they affect the price.',
    },
  ],
  faqs: faqContent.items.map(({ question, answer }) => ({ question, answer })),
  closing: {
    eyebrow: 'Ready when you are',
    title: 'Request a quote with the scope in view.',
    body: 'Tell us about the space and requested service. We will review the details and confirm final pricing after human scope review.',
    note: 'Questions or a specialty scope? Email mintbloom-pro@polsia.app.',
  },
  serviceNotes: {
    title: 'When a quote is needed.',
    body: 'A human review keeps variable work from being presented as fixed-price service.',
    bullets: [
      'Deep cleaning and move-in / move-out remain quote-required.',
      'Commercial service and extended travel remain quote-required.',
      'Add-on caps protect the fixed menu from becoming an open-ended promise.',
    ],
  },
};

export function getSiteContent(): SiteContentValues {
  return SiteContentResponse.parse(SITE_CONTENT);
}
