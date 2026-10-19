// @polsia:user-owned — booking CTA navigation regression coverage.
import { expect, test, type Page } from '@playwright/test';

const serviceCtas = [
  { name: 'Book one visit', service: 'oneTimeResidential' },
  { name: 'Choose a cadence', service: 'recurringResidential' },
  { name: 'Request a quote', service: 'deepCleaning' },
] as const;

async function assertBookingJourney(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(page.locator('#plans')).toBeVisible();

  for (const serviceCta of serviceCtas) {
    await page.goto('/');
    const cta = page.locator('#plans').getByRole('link', { name: serviceCta.name });
    await expect(cta).toHaveAttribute('href', `/book?service=${serviceCta.service}`);
    await cta.click();
    await expect(page).toHaveURL(new RegExp(`/book\\?service=${serviceCta.service}$`));
    await expect(
      page.getByRole('heading', { name: 'Choose the kind of care your space needs.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('radio', {
        name: /one-time residential|recurring residential|deep cleaning/i,
      }).first(),
    ).toBeVisible();
  }
}

test('header booking CTA opens the booking flow at both viewport sizes', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const cta = page.locator('header').getByRole('link', { name: 'Book a clean' });
    await expect(cta).toHaveAttribute('href', '/book');
    await cta.click();
    await expect(page).toHaveURL(/\/book$/);
    await expect(
      page.getByRole('heading', { name: 'Choose the kind of care your space needs.' }),
    ).toBeVisible();
  }
});

test('homepage keeps a booking link visible when content loading fails', async ({ page }) => {
  await page.route('**/api/site-content', (route) => route.abort());
  await page.goto('/');
  const errorState = page.locator('main').filter({ hasText: 'We could not load the Mintbloom homepage.' });
  await expect(errorState).toBeVisible();
  const cta = errorState.getByRole('link', { name: 'Book a clean' });
  await expect(cta).toHaveAttribute('href', '/book');
  await cta.click();
  await expect(page).toHaveURL(/\/book$/);
});

test('services CTAs open the selected booking flow on desktop and mobile', async ({ page }) => {
  test.setTimeout(60_000);
  await assertBookingJourney(page, { width: 1440, height: 900 });
  await assertBookingJourney(page, { width: 390, height: 844 });
});
