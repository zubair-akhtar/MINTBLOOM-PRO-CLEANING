// @polsia:user-owned — authenticated reschedule journey with a local email sink.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type APIRequestContext } from '@playwright/test';

const prisma = new PrismaClient();
const emailSinkURL = 'http://127.0.0.1:3199';
const password = 'Mintbloom-e2e-password-2026';

type CapturedEmail = { to: string; subject: string; body: string; html?: string };

let subscriberEmail: string | null = null;
let bookingId: string | null = null;

function isCapturedEmail(value: unknown): value is CapturedEmail {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'to' in value &&
    typeof value.to === 'string' &&
    'subject' in value &&
    typeof value.subject === 'string' &&
    'body' in value &&
    typeof value.body === 'string' &&
    (!('html' in value) || typeof value.html === 'string')
  );
}

async function capturedEmails(request: APIRequestContext): Promise<CapturedEmail[]> {
  const response = await request.get(`${emailSinkURL}/messages`);
  expect(response.ok()).toBe(true);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || !payload.every(isCapturedEmail)) {
    throw new Error('The local email sink returned an invalid message list.');
  }
  return payload;
}

function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function longDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

async function clearCapturedEmails(request: APIRequestContext): Promise<void> {
  const response = await request.delete(`${emailSinkURL}/messages`);
  expect(response.status()).toBe(204);
}

test.afterEach(async ({ request }) => {
  if (bookingId) await prisma.booking.deleteMany({ where: { id: bookingId } });
  if (subscriberEmail) await prisma.user.deleteMany({ where: { email: subscriberEmail } });
  await clearCapturedEmails(request);
  bookingId = null;
  subscriberEmail = null;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('reschedules a paid recurring visit and emails only after the saved update', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const token = randomUUID();
  const email = `manage-reschedule-${token}@example.test`;
  subscriberEmail = email;

  await clearCapturedEmails(request);
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Manage Reschedule Test');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);

  await expect
    .poll(async () => (await capturedEmails(request)).filter((message) => message.to === email))
    .toHaveLength(1);
  const verificationEmail = (await capturedEmails(request)).find(
    (message) => message.to === email,
  );
  expect(verificationEmail).toBeDefined();
  if (!verificationEmail?.html) throw new Error('Signup did not send a verification link.');
  const href = verificationEmail.html.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  expect(href).toBeDefined();
  if (!href) throw new Error('The verification email did not contain a link.');
  const verificationURL = new URL(href);
  await page.goto(`${verificationURL.pathname}${verificationURL.search}`);

  const verifiedUser = await prisma.user.findUnique({ where: { email } });
  expect(verifiedUser?.emailVerified).toBe(true);

  const serviceDate = addDays(new Date(), 14);
  const targetDate = addDays(serviceDate, 14);
  const rejectedDate = addDays(serviceDate, 1);
  const booking = await prisma.booking.create({
    data: {
      fullName: 'Manage Reschedule Test',
      email,
      phone: '5550100123',
      addressLine1: '100 Test Street',
      city: 'Lubbock',
      state: 'TX',
      zip: '79401',
      bedrooms: 2,
      bathrooms: 1,
      tier: 'biweekly',
      serviceType: 'recurringResidential',
      cadence: 'biweekly',
      serviceDate,
      quotedAmountCents: 12500,
      paymentAmountCents: 12500,
      checkoutSessionId: `e2e-reschedule-${token}`,
    },
  });
  bookingId = booking.id;

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);

  await clearCapturedEmails(request);
  await page.goto('/manage');
  const manageResponse = await page.evaluate(async () => {
    const response = await fetch('/api/manage/subscription');
    return { status: response.status, body: await response.text() };
  });
  expect(manageResponse.status, manageResponse.body).toBe(200);
  expect(JSON.parse(manageResponse.body)).toMatchObject({ subscription: { id: booking.id } });
  const dateInput = page.getByLabel('Choose a new visit date');
  await expect(dateInput).toBeVisible();
  await dateInput.fill(dateOnly(rejectedDate));
  await page.getByRole('button', { name: 'Save new date' }).click();
  await expect(page.getByText('That date is not available for rescheduling.')).toBeVisible();
  const unchangedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
  expect(unchangedBooking?.serviceDate.toISOString().slice(0, 10)).toBe(dateOnly(serviceDate));
  expect(await capturedEmails(request)).toHaveLength(0);

  await dateInput.fill(dateOnly(targetDate));
  await page.getByRole('button', { name: 'Save new date' }).click();
  await expect(
    page.getByText(`Your next visit is now scheduled for ${longDate(targetDate)}.`),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const savedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
      return savedBooking?.serviceDate.toISOString().slice(0, 10);
    })
    .toBe(dateOnly(targetDate));
  await expect
    .poll(async () =>
      (await capturedEmails(request)).filter(
        (message) => message.subject === 'Your Mintbloom recurring clean was rescheduled',
      ),
    )
    .toHaveLength(1);

  const confirmation = (await capturedEmails(request)).find(
    (message) => message.subject === 'Your Mintbloom recurring clean was rescheduled',
  );
  expect(confirmation).toBeDefined();
  expect(confirmation?.to).toBe(email);
  expect(confirmation?.body).toContain('Service: Recurring residential clean · Biweekly');
  expect(confirmation?.body).toContain(`Original visit date: ${longDate(serviceDate)}`);
  expect(confirmation?.body).toContain(`New visit date: ${longDate(targetDate)}`);
  expect(confirmation?.body).toContain('Biweekly visits keep their weekday rhythm.');
  expect(confirmation?.body).toContain(
    'Future reschedule requests must be received at least 24 hours before the scheduled visit.',
  );
});
