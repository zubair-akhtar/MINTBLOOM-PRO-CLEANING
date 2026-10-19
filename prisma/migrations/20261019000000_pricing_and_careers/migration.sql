-- Careers markets + pricing rate cards (required for live /book estimates).

CREATE TABLE IF NOT EXISTS "ServiceMarket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "combinedTaxRateBps" INTEGER,
    "pricingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceMarket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceMarket_city_state_key" ON "ServiceMarket"("city", "state");
CREATE INDEX IF NOT EXISTS "ServiceMarket_state_isActive_idx" ON "ServiceMarket"("state", "isActive");

DO $$ BEGIN
  CREATE TYPE "JobOpeningStatus" AS ENUM ('draft', 'published', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "JobOpening" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employmentArea" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "compensation" TEXT,
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "marketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobOpening_status_closedAt_idx" ON "JobOpening"("status", "closedAt");
CREATE INDEX IF NOT EXISTS "JobOpening_marketId_idx" ON "JobOpening"("marketId");

CREATE TABLE IF NOT EXISTS "JobApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "roleInterest" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "experience" TEXT,
    "message" TEXT,
    "consent" BOOLEAN NOT NULL,
    "openingId" TEXT,
    "marketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobApplication_createdAt_idx" ON "JobApplication"("createdAt");
CREATE INDEX IF NOT EXISTS "JobApplication_openingId_idx" ON "JobApplication"("openingId");
CREATE INDEX IF NOT EXISTS "JobApplication_marketId_idx" ON "JobApplication"("marketId");
CREATE INDEX IF NOT EXISTS "JobApplication_email_idx" ON "JobApplication"("email");

CREATE TABLE IF NOT EXISTS "PricingRateCard" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PricingRateCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PricingRateCard_version_key" ON "PricingRateCard"("version");
CREATE INDEX IF NOT EXISTS "PricingRateCard_isActive_idx" ON "PricingRateCard"("isActive");

DO $$ BEGIN
  ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_marketId_fkey"
    FOREIGN KEY ("marketId") REFERENCES "ServiceMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_openingId_fkey"
    FOREIGN KEY ("openingId") REFERENCES "JobOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_marketId_fkey"
    FOREIGN KEY ("marketId") REFERENCES "ServiceMarket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
