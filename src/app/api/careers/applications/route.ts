// @polsia:user-owned — public careers application endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { CareersApplicationInput, CareersApplicationResult } from '@/lib/contracts/careers';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { careersApplicationNotificationEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

function fieldErrors(input: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

export async function POST(request: Request) {
  const parsed = CareersApplicationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const selectedOpening = input.openingId
      ? await prisma.jobOpening.findUnique({
          where: { id: input.openingId },
          select: {
            id: true,
            title: true,
            role: true,
            city: true,
            state: true,
            marketId: true,
            status: true,
            closedAt: true,
            market: { select: { isActive: true } },
          },
        })
      : null;

    if (
      input.openingId &&
      (!selectedOpening ||
        selectedOpening.status !== 'published' ||
        selectedOpening.closedAt ||
        !selectedOpening.market.isActive)
    ) {
      return NextResponse.json(
        {
          errors: {
            openingId:
              'That opening is no longer accepting applications. Please choose general interest.',
          },
        },
        { status: 409 },
      );
    }

    const selectedMarketId = selectedOpening?.marketId ?? input.marketId;
    if (input.marketId && selectedOpening && input.marketId !== selectedOpening.marketId) {
      return NextResponse.json(
        { errors: { marketId: 'Choose the market connected to the selected opening.' } },
        { status: 400 },
      );
    }

    const selectedMarket = selectedMarketId
      ? await prisma.serviceMarket.findFirst({
          where: { id: selectedMarketId, isActive: true },
          select: { id: true, name: true, city: true, state: true },
        })
      : null;
    if (selectedMarketId && !selectedMarket) {
      return NextResponse.json(
        { errors: fieldErrors({ marketId: 'Choose an active service market.' }) },
        { status: 400 },
      );
    }

    const application = await prisma.jobApplication.create({
      data: {
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        roleInterest: input.roleInterest,
        availability: input.availability,
        experience: input.experience || null,
        message: input.message || null,
        consent: input.consent,
        openingId: selectedOpening?.id ?? null,
        marketId: selectedMarket?.id ?? null,
      },
      select: { id: true },
    });

    try {
      const emailContent = careersApplicationNotificationEmail({
        applicationId: application.id,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        roleInterest: input.roleInterest,
        opening: selectedOpening
          ? `${selectedOpening.title} (${selectedOpening.role})`
          : 'General interest',
        market: selectedMarket
          ? `${selectedMarket.name}, ${selectedMarket.state}`
          : 'Not specified',
        availability: input.availability,
        experience: input.experience,
        message: input.message,
      });
      if (env.POLSIA_COMPANY_EMAIL) {
        await sendEmail({
          to: env.POLSIA_COMPANY_EMAIL,
          ...emailContent,
        });
      }
    } catch {
      // The application is already persisted; email delivery must not erase it.
    }

    return NextResponse.json(
      CareersApplicationResult.parse({
        applicationId: application.id,
        message: 'Thanks — Mintbloom received your interest and will review it.',
      }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Could not submit application' }, { status: 500 });
  }
}
