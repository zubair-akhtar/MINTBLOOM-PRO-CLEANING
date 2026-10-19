// @polsia:user-owned — public Texas market list and ZIP-based coverage guidance.

export const texasMarkets = [
  'Lubbock',
  'New Deal',
  'Wolfforth',
  'Plainview',
  'Houston',
  'Dallas',
  'Austin',
  'Additional Texas markets—request availability',
] as const;

export const coverageRules = [
  {
    id: 'core',
    title: 'Core area',
    description: 'Lubbock core ZIP codes are eligible for the approved residential menu.',
  },
  {
    id: 'nearby',
    title: 'Nearby areas',
    description:
      'Approved nearby ZIP codes may use residential service. Recurring work stays within the approved Lubbock-area list.',
  },
  {
    id: 'extended',
    title: 'Extended areas',
    description:
      'Addresses outside the approved Lubbock-area ZIP lists need travel and scope review before a quote.',
  },
] as const;

export const areaRequestNotice =
  'Request received. We’ll review the location and scope; this does not confirm service availability or a booking.';

export const areaAvailabilityNote =
  'A city name alone does not confirm availability. The service ZIP and requested scope determine whether an address is core, nearby, or extended.';
