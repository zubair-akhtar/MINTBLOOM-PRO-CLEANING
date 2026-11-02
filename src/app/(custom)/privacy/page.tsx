// @polsia:user-owned — public privacy page with the owner's exact source content.

import type { Metadata } from 'next';
import { LegalPage } from '@/components/custom/legal-page';
import { privacyText } from '@/lib/legal/privacy';

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy | Mintbloom' },
  description: 'Privacy Policy for Mintbloomproclean.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      introduction="A clear reference for how customer information is handled. The effective date is shown below."
      sourceText={privacyText}
      documentPath="/privacy"
      crossLink={{ href: '/terms', label: 'Terms and Conditions' }}
    />
  );
}
