// @polsia:user-owned — public terms page with the owner's exact source content.

import type { Metadata } from 'next';
import { LegalPage } from '@/components/custom/legal-page';
import { termsText } from '@/lib/legal/terms';

export const metadata: Metadata = {
  title: { absolute: 'Terms and Conditions | Mintbloom' },
  description: 'Terms and Conditions of Service for Mintbloomproclean.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      introduction="A clear reference for your cleaning visits and service details. The effective date is shown below."
      sourceText={termsText}
      documentPath="/terms"
      crossLink={{ href: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
