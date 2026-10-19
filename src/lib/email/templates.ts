// @polsia:user-owned — your email templates. Edit, add, or delete freely.
// Each template returns { subject, html, text }; send it via the framework transport:
//   import { sendEmail } from '@/lib/email/send';
//   import { welcomeEmail } from '@/lib/email/templates';
//   await sendEmail({ to: user.email, ...welcomeEmail({ name: user.name }) });
// renderEmail() is a plain inline-styled shell — email clients drop <style>/<link>, so style inline.
// renderEmail() auto-escapes its heading/body/cta/footer, so pass RAW values (don't escapeHtml() them
// first — that double-escapes). escapeHtml() is only for when you hand-build an html string yourself.

import type { BookingSummary } from '@/lib/contracts/bookings';
import type {
  BuilderBudgetaryEstimate,
  BuilderInquirySubmission,
} from '@/lib/contracts/builder-inquiries';

/** Subject + rendered bodies — spread into sendEmail({ to, ... }). */
export interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

export interface RenderEmailOptions {
  heading: string;
  /** Body paragraphs (plain text; escaped for you). */
  body: string[];
  /** Optional call-to-action button. */
  cta?: { label: string; url: string };
  /** Optional footer line under the divider. */
  footer?: string;
}

/** Escape a value for safe interpolation into an HTML attribute or text node. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap content in a minimal, inline-styled email shell. Restyle to match the brand. */
export function renderEmail(options: RenderEmailOptions): { html: string; text: string } {
  const paragraphs = options.body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;color:#333333;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`,
    )
    .join('');
  const button = options.cta
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(options.cta.url)}" style="display:inline-block;padding:10px 20px;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;">${escapeHtml(options.cta.label)}</a></p>`
    : '';
  const footer = options.footer
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;color:#999999;font-size:12px;">${escapeHtml(options.footer)}</div>`
    : '';
  const html = [
    '<div style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;">',
    `<h1 style="margin:0 0 16px;color:#111111;font-size:22px;">${escapeHtml(options.heading)}</h1>`,
    paragraphs,
    button,
    footer,
    '</div>',
  ].join('');
  const text = [
    options.heading,
    '',
    ...options.body,
    ...(options.cta ? ['', `${options.cta.label}: ${options.cta.url}`] : []),
    ...(options.footer ? ['', options.footer] : []),
  ].join('\n');
  return { html, text };
}

// ─── Example templates — edit / add / remove to fit the app ───

/** Welcome email for a new signup. */
export function welcomeEmail(input: { name: string; ctaUrl?: string }): EmailContent {
  const { html, text } = renderEmail({
    heading: `Welcome, ${input.name}!`,
    body: ["Thanks for signing up — we're glad you're here."],
    cta: input.ctaUrl ? { label: 'Get started', url: input.ctaUrl } : undefined,
    footer: 'You received this because you created an account.',
  });
  return { subject: 'Welcome aboard', html, text };
}

/** Generic notification email. */
export function notificationEmail(input: {
  subject: string;
  title: string;
  lines: string[];
  cta?: { label: string; url: string };
}): EmailContent {
  const { html, text } = renderEmail({ heading: input.title, body: input.lines, cta: input.cta });
  return { subject: input.subject, html, text };
}

/** Confirmation sent after a subscriber's recurring visit date is saved. */
export function rescheduleConfirmationEmail(input: {
  serviceLabel: string;
  cadence: 'weekly' | 'biweekly' | 'monthly';
  previousServiceDate: Date;
  nextServiceDate: Date;
}): EmailContent {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  });
  const cadenceLabel = input.cadence.charAt(0).toUpperCase() + input.cadence.slice(1);
  const scheduleNote =
    input.cadence === 'monthly'
      ? 'Monthly visits keep their calendar day.'
      : `${cadenceLabel} visits keep their weekday rhythm.`;
  const { html, text } = renderEmail({
    heading: 'Your visit has been rescheduled',
    body: [
      `Service: ${input.serviceLabel} · ${cadenceLabel}`,
      `Original visit date: ${dateFormatter.format(input.previousServiceDate)}`,
      `New visit date: ${dateFormatter.format(input.nextServiceDate)}`,
      `Schedule note: ${scheduleNote}`,
      'Future reschedule requests must be received at least 24 hours before the scheduled visit.',
    ],
    footer: 'Mintbloom Pro LLC',
  });
  return {
    subject: 'Your Mintbloom recurring clean was rescheduled',
    html,
    text,
  };
}

export function bookingConfirmationEmail(input: {
  name: string;
  bookingId: string;
  summary: BookingSummary;
  serviceDate: string;
}): EmailContent {
  const addOnLines = input.summary.selectedAddOns.length
    ? input.summary.selectedAddOns.map(
        (addOn) =>
          `${addOn.label} (${addOn.quantity} ${addOn.unitLabel}): ${addOn.displayAmount}; scope: ${addOn.scope ?? 'Fixed catalog scope'}; exceptions: ${addOn.quoteReason ?? 'None listed'}`,
      )
    : ['None selected'];
  const { html, text } = renderEmail({
    heading: 'Your Mintbloom clean is booked',
    body: [
      `Thanks, ${input.name}. Your payment was received and your booking is confirmed.`,
      `Booking reference: ${input.bookingId}`,
      `Service: ${input.summary.serviceLabel}${input.summary.cadenceLabel ? ` · ${input.summary.cadenceLabel}` : ''}`,
      `Included: ${input.summary.inclusions.join(' · ')}`,
      `Not included: ${input.summary.exclusions.join(' · ')}`,
      `Add-ons: ${addOnLines.join(' · ')}`,
      `Lines: ${input.summary.lines.map((line) => `${line.label}: ${line.displayAmount}`).join(' · ')}`,
      `Area: ${input.summary.areaClassification} · Travel: ${input.summary.travelDisplayAmount}`,
      `Total paid: ${input.summary.totalDisplayAmount}`,
      `Visit date: ${input.serviceDate}`,
      'We will follow up with arrival details before your visit.',
    ],
    footer:
      'Mintbloom Pro LLC · Fully registered, bonded, and insured with general liability coverage.',
  });
  return { subject: 'Mintbloom booking confirmed', html, text };
}

export function quoteRequestNotificationEmail(input: {
  requestReference: string;
  name: string;
  email: string;
  summary: BookingSummary;
  serviceDate: string;
  scope?: string;
}): EmailContent {
  const { html, text } = renderEmail({
    heading: 'New Mintbloom quote request',
    body: [
      `Request ${input.requestReference} from ${input.name} (${input.email}).`,
      `Service: ${input.summary.serviceLabel}${input.summary.cadenceLabel ? ` · ${input.summary.cadenceLabel}` : ''} · area: ${input.summary.areaClassification} · requested date: ${input.serviceDate}.`,
      `Included: ${input.summary.inclusions.join(' · ')}`,
      `Not included: ${input.summary.exclusions.join(' · ')}`,
      `Scope: ${input.scope || 'No additional scope provided.'}`,
      `Add-ons: ${input.summary.selectedAddOns.length ? input.summary.selectedAddOns.map((addOn) => `${addOn.label} (${addOn.quantity} ${addOn.unitLabel}) · ${addOn.displayAmount} · scope: ${addOn.scope ?? 'Fixed catalog scope'} · exceptions: ${addOn.quoteReason ?? 'None listed'}`).join(' · ') : 'None selected'}.`,
      `Travel: ${input.summary.travelDisplayAmount} · status: ${input.summary.travelPricingStatus}.`,
      `Quote status: ${input.summary.pricingStatus} · visible total: ${input.summary.totalDisplayAmount}.`,
    ],
    footer:
      'Mintbloom Pro LLC · Quote request for condition, size, safety, specialty-material, or travel review.',
  });
  return { subject: `New Mintbloom quote request · ${input.requestReference}`, html, text };
}

export function careersApplicationNotificationEmail(input: {
  applicationId: string;
  fullName: string;
  email: string;
  phone?: string;
  roleInterest: string;
  opening: string;
  market: string;
  availability: string;
  experience?: string;
  message?: string;
}): EmailContent {
  const { html, text } = renderEmail({
    heading: 'New Mintbloom careers application',
    body: [
      `Application ${input.applicationId} from ${input.fullName} (${input.email}).`,
      `Role interest: ${input.roleInterest}. Opening: ${input.opening}. Market: ${input.market}.`,
      `Phone: ${input.phone || 'Not provided'}. Availability: ${input.availability}.`,
      `Experience: ${input.experience || 'Not provided'}.`,
      `Message: ${input.message || 'Not provided'}.`,
    ],
    footer: 'Submitted through the public Mintbloom careers page.',
  });
  return { subject: `New careers application · ${input.fullName}`, html, text };
}

export function builderInquiryNotificationEmail(input: {
  inquiryReference: string;
  input: BuilderInquirySubmission;
  estimate: BuilderBudgetaryEstimate;
}): EmailContent {
  const project = input.input;
  const { html, text } = renderEmail({
    heading: 'New Mintbloom builder / developer inquiry',
    body: [
      `Inquiry ${input.inquiryReference} from ${project.companyName}.`,
      `Project contact: ${project.projectContactName} · ${project.projectContactEmail} · ${project.projectContactPhone}.`,
      `Address: ${project.projectAddressLine1}${project.projectAddressLine2 ? `, ${project.projectAddressLine2}` : ''}, ${project.projectCity}, ${project.projectState} ${project.projectZip}.`,
      `Units: ${project.startingUnitCount} starting / ${project.totalPlannedUnitCount} total planned. Unit mix: ${project.unitMix.map((row) => `${row.unitType} × ${row.count}`).join(', ')}.`,
      `Approximate size: ${project.approximateSquareFootage.toLocaleString('en-US')} total square feet · ${project.furnishingStatus}.`,
      `Construction: ${project.constructionStage} · access: ${project.siteAccess} · utilities/readiness: ${project.utilityReadiness}.`,
      `Cleaning scopes: ${project.cleaningScopes.join(', ')} · phased: ${project.isPhased ? 'yes' : 'no'} · recurring: ${project.isRecurring ? 'yes' : 'no'}.`,
      `Remaining debris or residue: ${project.remainingDebris}.`,
      `Appliances, windows, or other special scope: ${project.appliancesWindowsOther}.`,
      `Target handover/client move-in: ${project.targetHandoverDate} · preferred final clean: ${project.preferredFinalCleanDate}.`,
      `Notes: ${project.notes || 'None provided.'}`,
      `Budgetary estimate: ${input.estimate.perUnitRange}; ${input.estimate.projectRange}; volume ${input.estimate.volumeBand}; area ${input.estimate.areaClassification}.`,
      `Assumptions: ${input.estimate.assumptions.join(' · ')}`,
      input.estimate.disclaimer,
    ],
    footer:
      'Mintbloom Pro LLC · Registered LLC, bonded, and covered by general liability insurance. Review scope or schedule a site walkthrough before final pricing.',
  });
  return {
    subject: `New builder inquiry · ${project.companyName} · ${input.inquiryReference}`,
    html,
    text,
  };
}
