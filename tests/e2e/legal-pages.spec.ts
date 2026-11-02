// @polsia:user-owned — verifies public legal routes, exact rendered source, and responsive links.
import { expect, test, type Page } from '@playwright/test';
import { privacyText } from '../../src/lib/legal/privacy';
import { termsText } from '../../src/lib/legal/terms';

async function expectExactLegalBlocks(page: Page, sourceText: string): Promise<void> {
  const renderedBlocks = await page
    .locator('[data-legal-document] [data-legal-block]')
    .evaluateAll((elements) =>
      elements.map((element) => {
        if (element instanceof HTMLUListElement) {
          return Array.from(element.querySelectorAll('li'))
            .map((item) => item.textContent ?? '')
            .join('\n');
        }
        return element.innerText;
      }),
    );
  const expectedBlocks = sourceText.replace(/\n$/, '').split('\n\n');
  expect(renderedBlocks).toEqual(expectedBlocks);
}

async function expectResponsiveLegalPage(page: Page): Promise<void> {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyFontSize: Number.parseFloat(
        window.getComputedStyle(document.querySelector('[data-legal-document]') ?? document.body)
          .fontSize,
      ),
    }));
    expect(dimensions.documentWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
      dimensions.viewportWidth,
    );
    expect(dimensions.bodyFontSize).toBeGreaterThanOrEqual(16);

    const footerLinks = page.locator('footer nav a');
    await expect(footerLinks).toHaveCount(6);
    for (const label of ['Careers', 'Contact', 'Service areas', 'Blog', 'Terms', 'Privacy']) {
      const link = page.locator('footer nav').getByRole('link', { name: label, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
  }
}

test('terms page serves the complete source with canonical metadata and working links', async ({
  page,
}) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms and Conditions' })).toBeVisible();
  await expect(page).toHaveTitle('Terms and Conditions | Mintbloom');
  await expect(page.locator('.contact-actions-floating')).toHaveCount(0);
  const canonicalHref = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonicalHref).not.toBeNull();
  const canonical = new URL(canonicalHref ?? '');
  expect(canonical.pathname).toBe('/terms');
  await expectExactLegalBlocks(page, termsText);
  await expect(page.locator('footer').getByRole('link', { name: 'Terms', exact: true })).toHaveAttribute(
    'href',
    '/terms',
  );
  await expect(page.locator('footer').getByRole('link', { name: 'Privacy', exact: true })).toHaveAttribute(
    'href',
    '/privacy',
  );
  await expect(page.getByRole('link', { name: 'Privacy Policy', exact: true })).toHaveAttribute(
    'href',
    '/privacy',
  );
  await expectResponsiveLegalPage(page);
  await page.setViewportSize({ width: 390, height: 844 });
});

test('privacy page serves the complete source, links back to terms, and appears in the sitemap', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
  await expect(page).toHaveTitle('Privacy Policy | Mintbloom');
  await expect(page.locator('.contact-actions-floating')).toHaveCount(0);
  const canonicalHref = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonicalHref).not.toBeNull();
  const canonical = new URL(canonicalHref ?? '');
  expect(canonical.pathname).toBe('/privacy');
  await expectExactLegalBlocks(page, privacyText);
  await expect(page.getByRole('link', { name: 'Terms and Conditions', exact: true })).toHaveAttribute(
    'href',
    '/terms',
  );

  const sitemapResponse = await page.request.get('/sitemap.xml');
  expect(sitemapResponse.ok()).toBe(true);
  const sitemapText = await sitemapResponse.text();
  expect(sitemapText).toContain('/terms</loc>');
  expect(sitemapText).toContain('/privacy</loc>');

  await expectResponsiveLegalPage(page);
  await page.setViewportSize({ width: 390, height: 844 });
});
