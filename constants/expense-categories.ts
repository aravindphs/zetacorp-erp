/**
 * Default expense categories seeded at bootstrap (spec §301). Admins can add
 * more later — these are data rows, not a fixed enum.
 */
export const DEFAULT_EXPENSE_CATEGORIES: readonly { name: string; description: string }[] = [
  { name: 'Travel', description: 'Travel fares and transport.' },
  { name: 'Fuel', description: 'Vehicle fuel expenses.' },
  { name: 'Food', description: 'Meals and refreshments.' },
  { name: 'Accommodation', description: 'Lodging and stay.' },
  { name: 'Office Supplies', description: 'Stationery and office consumables.' },
  { name: 'Client Meeting', description: 'Client meeting expenses.' },
  { name: 'Training', description: 'Courses, certifications, workshops.' },
  { name: 'Communication', description: 'Phone and mobile expenses.' },
  { name: 'Internet', description: 'Internet and data expenses.' },
  { name: 'Miscellaneous', description: 'Other business expenses.' },
];
