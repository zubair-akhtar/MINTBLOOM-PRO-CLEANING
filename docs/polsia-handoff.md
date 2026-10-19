# Polsia handoff log (local → Polsia)

**Purpose:** Track meaningful code changes we make locally so we can give Polsia a short prompt at the end. Do not upload the repo; paste the final prompt into Polsia.

**Baseline:** Fresh from 2026-10-19 — local clone of Mintbloom Pro (Polsia `polsia-next-v2`).

**Rules for this log**
- Record only intentional product/UI/logic changes (not local-only setup: `.env`, Postgres, email sink, `npm install`, GitHub pushes).
- Prefer **user-owned** paths (see `.polsia/ownership.json`). Avoid asking Polsia to edit `framework_owned` files.
- Each entry: what / why / files / brief before→after or snippet refs.

---

## Change log

| # | Date | What | Why | Files |
|---|------|------|-----|-------|
| 1 | 2026-10-19 | Admin login redirects to `/admin` | Admins land on admin dashboard after sign-in | `src/components/custom/sign-in-form.tsx` |
| 2 | 2026-10-19 | v3 pricing engine + defaults + unit tests | Spec formula (sqft over 600 + rooms + add-ons + tax) | `src/lib/business/pricing/**`, `tests/unit/pricing/calculate.test.ts` |
| 3 | 2026-10-19 | `PricingRateCard` model + market tax fields | Admin-editable rate card & per-market tax | `prisma/schema/pricing.prisma`, `prisma/schema/careers.prisma` (`ServiceMarket`) |
| 4 | 2026-10-19 | Estimate + admin pricing APIs | Live estimate; versioned settings save | `src/app/api/pricing/estimate/route.ts`, `src/app/api/admin/pricing-settings/route.ts`, `src/lib/contracts/pricing.ts` |
| 5 | 2026-10-19 | `/book` live calculator UI | Customer estimate → submit request only | `src/components/custom/pricing-calculator.tsx`, `src/app/(custom)/book/page.tsx`, `src/lib/service-intake-config/forms.ts` (v2 + `estimate_snapshot`) |
| 6 | 2026-10-19 | Admin Calculator settings page | Edit rates & market tax | `src/app/(dashboard)/admin/calculator/page.tsx`, `src/components/custom/calculator-settings.tsx`, `admin-nav.tsx`, `admin/page.tsx` |
| 7 | 2026-10-19 | Seed launch markets with tax + rate card | Lubbock-area pricingEnabled + 8.25% | `src/lib/seed.ts` |
| 8 | 2026-10-19 | /book wizard UX redesign | Step order service→details→address; validation; icons; estimate panel; Places autocomplete | `pricing-calculator.tsx`, `address-autocomplete.tsx`, `api/places/**`, `env.ts` |

---

## Final Polsia prompt (draft — refine when you say complete)

```text
Mintbloom Pro: implement the v3 Dynamic Pricing Calculator (submit request only; no Stripe).

1) After admin sign-in, redirect role=admin to /admin (edit sign-in-form.tsx).
2) Add Prisma PricingRateCard (versioned JSON settings) and on ServiceMarket: combinedTaxRateBps, pricingEnabled. Seed Lubbock/New Deal/Wolfforth/Plainview with pricingEnabled=true and tax 825 bps; seed active rate card with v3 defaults ($145/$325/$395/$210 bases, sqft rates, room rates).
3) Add src/lib/business/pricing/ with defaults + calculateEstimate (order: validate/gates → core → discount → minimum → extras/fees → tax). Gates: 5+ beds, commercial, post-construction, >3500 sqft, >4 bath eq, unknown sqft, market not pricing-enabled, missing tax → quote_required (clear total).
4) POST /api/pricing/estimate (public) and GET/PUT /api/admin/pricing-settings (admin; PUT creates new version).
5) Replace /book with multi-step PricingCalculator: live estimate panel, commercial → Request Walkthrough, gated → Request Quote, else Submit estimate request via /api/service-intake including estimate_snapshot JSON.
6) Admin nav + /admin/calculator to edit service rates and per-market tax %.

Do not edit framework_owned auth core. Keep data plane via /api only (no Server Actions).
```
