// @polsia:user-owned — Mintbloom's public service-request form definition.
import type { FormDefinition } from '@/modules/service-intake/contracts';

export const intakeForms: FormDefinition[] = [
  {
    id: 'cleaning-quote',
    version: 2,
    title: 'Request a customized quote',
    description:
      'Share the service and property details below. We will review the scope and contact you with next steps. A preferred date is a request only, not a confirmed booking.',
    confirmation:
      'We will review your service and property details and contact you. Your preferred date is not a confirmed booking, and final pricing is confirmed after scope review.',
    steps: [
      {
        id: 'service',
        title: 'Service and property',
        fields: [
          {
            id: 'service_type',
            type: 'single',
            label: 'Service needed',
            required: true,
            options: [
              { value: 'basicResidential', label: 'Basic Cleaning' },
              { value: 'oneTimeResidential', label: 'One-time residential cleaning' },
              { value: 'recurringResidential', label: 'Recurring residential cleaning' },
              { value: 'deepCleaning', label: 'Deep cleaning' },
              { value: 'moveInMoveOut', label: 'Move-in / move-out cleaning' },
              { value: 'officeCommercial', label: 'Office / commercial cleaning' },
              { value: 'postConstruction', label: 'Post-construction cleaning' },
              { value: 'medicalGradeSanitation', label: 'Medical-grade sanitation' },
            ],
          },
          {
            id: 'property_type',
            type: 'single',
            label: 'Property type',
            required: true,
            options: [
              { value: 'residential', label: 'Home or apartment' },
              { value: 'commercial', label: 'Office, clinic, retail, or other commercial space' },
              { value: 'builder', label: 'Build, turnover, or post-construction property' },
            ],
          },
          {
            id: 'bedrooms',
            type: 'number',
            label: 'Bedrooms',
            min: 0,
            max: 100,
            help: 'Use 0 for a commercial or non-residential space.',
          },
          {
            id: 'bathrooms',
            type: 'number',
            label: 'Bathrooms',
            min: 0,
            max: 100,
            help: 'Use 0 for a commercial or non-residential space.',
          },
          {
            id: 'cadence',
            type: 'single',
            label: 'Preferred cadence',
            options: [
              { value: 'one_time', label: 'One time' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'biweekly', label: 'Biweekly' },
              { value: 'monthly', label: 'Monthly' },
            ],
          },
          {
            id: 'add_ons',
            type: 'multiple',
            label: 'Interested in any add-ons?',
            options: [
              { value: 'dishes', label: 'Dishes or one dishwasher / sink load' },
              { value: 'insideMicrowave', label: 'Inside the microwave' },
              { value: 'insideOven', label: 'Inside the oven' },
              { value: 'insideFridge', label: 'Inside the refrigerator' },
              { value: 'baseboardDetail', label: 'Baseboard detail' },
              { value: 'lightWallSpotCleaning', label: 'Light wall spot-cleaning' },
              { value: 'additionalBathroom', label: 'Additional bathroom' },
              { value: 'bedMaking', label: 'Bed making' },
              { value: 'interiorWindows', label: 'Interior windows' },
              { value: 'blinds', label: 'Blinds' },
              { value: 'insideKitchenCabinets', label: 'Inside kitchen cabinets' },
              { value: 'laundry', label: 'Laundry' },
              { value: 'petHairHeavyBuildup', label: 'Pet hair or heavy buildup' },
            ],
          },
        ],
      },
      {
        id: 'property_details',
        title: 'Property details',
        fields: [
          { id: 'street', type: 'text', label: 'Street address', required: true, maxLength: 180 },
          { id: 'unit', type: 'text', label: 'Unit or suite', maxLength: 180 },
          { id: 'city', type: 'text', label: 'City', required: true, maxLength: 100 },
          { id: 'state', type: 'text', label: 'State', required: true, maxLength: 80 },
          { id: 'zip', type: 'text', label: 'ZIP code', required: true, maxLength: 10 },
          {
            id: 'preferred_date',
            type: 'date',
            label: 'Preferred service date',
            help: 'A preference only. We will confirm timing after reviewing the request.',
          },
          {
            id: 'scope_notes',
            type: 'textarea',
            label: 'Tell us about the space and requested scope',
            required: true,
            maxLength: 4000,
            help: 'Include size, condition, access, readiness, sanitation needs, or anything else we should review.',
          },
          {
            id: 'estimate_snapshot',
            type: 'textarea',
            label: 'Estimate snapshot',
            required: false,
            maxLength: 4000,
            help: 'System-generated estimate JSON for admin review.',
          },
        ],
      },
      {
        id: 'contact',
        title: 'How to reach you',
        fields: [
          { id: 'full_name', type: 'text', label: 'Full name', required: true, maxLength: 120 },
          { id: 'email', type: 'email', label: 'Email', required: true, maxLength: 254 },
          { id: 'phone', type: 'tel', label: 'Phone number', required: true, maxLength: 40 },
        ],
      },
    ],
  },
];
