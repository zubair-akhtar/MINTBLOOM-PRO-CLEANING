// @polsia:user-owned — real contact-form browser journey against a disposable database.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();
let submissionEmail: string | null = null;
let submissionMarker: string | null = null;

test.afterEach(async () => {
  if (submissionEmail && submissionMarker) {
    await prisma.contactMessage.deleteMany({
      where: {
        email: submissionEmail,
        message: { contains: submissionMarker },
      },
    });
  }
  submissionEmail = null;
  submissionMarker = null;
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('renders Texas coverage and saves an area request on desktop and mobile', async ({ page }) => {
  test.setTimeout(60_000);
  const token = randomUUID();
  const email = `areas-${token}@example.test`;
  const marker = `area-request-${token}`;
  submissionEmail = email;
  submissionMarker = marker;
  const message = `${marker}: Austin, 78701, one-time residential cleaning; 2-bedroom home.`;

  await page.goto('/areas');
  await expect(page.getByRole('heading', { name: 'Texas Service Areas', level: 1 })).toBeVisible();
  for (const market of ['Lubbock', 'New Deal', 'Wolfforth', 'Plains', 'Houston', 'Dallas', 'Austin']) {
    await expect(page.getByText(market, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Additional Texas markets—request availability')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Core area' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nearby areas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Extended areas' })).toBeVisible();
  const availabilityNotes = page.getByText(/city name alone does not confirm availability/i);
  await expect(availabilityNotes).toHaveCount(2);
  await expect(availabilityNotes.first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  const footer = page.locator('footer');
  await footer.getByRole('link', { name: 'Service areas' }).scrollIntoViewIfNeeded();
  await expect(footer.getByRole('link', { name: 'Service areas' })).toBeVisible();
  await page.getByRole('link', { name: 'Request your area' }).click();
  await expect(page).toHaveURL(/#request-area$/);
  await expect(page.getByRole('heading', { name: 'Request your area' })).toBeVisible();

  await page.getByLabel('Your name').fill('Area Test Visitor');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Request my area' }).click();
  await expect(page.locator('#contact-message-error')).toContainText('Please enter a message.');
  await expect(page.getByRole('status')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/areas');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Request your area' }).click();
  await page.getByText('Your name', { exact: true }).click();
  expect(
    await page.locator('#contact-name').evaluate((element) => element === document.activeElement),
  ).toBe(true);

  await page.getByLabel('Your name').fill('Area Test Visitor');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Area request details').fill(message);
  await page.route('**/api/contact', (route) => route.abort());
  await page.getByRole('button', { name: 'Request my area' }).click();
  await expect(page.locator('#contact-message-error')).toContainText(
    'Something went wrong. Please try again.',
  );
  await expect(page.getByRole('status')).toHaveCount(0);

  await page.unroute('**/api/contact');
  await page.getByRole('button', { name: 'Request my area' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Request received. We’ll review the location and scope; this does not confirm service availability or a booking.',
  );

  const saved = await prisma.contactMessage.findFirst({
    where: {
      email,
      message: { contains: marker },
    },
  });
  expect(saved).not.toBeNull();
  expect(saved?.message).toContain('Austin, 78701');
});
