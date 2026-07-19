/**
 * Default system settings seeded at bootstrap (spec §41, §349–§352).
 *
 * Settings are stored as key/value rows in `system_settings`. `isPublic`
 * marks values safe to expose to the client (e.g. company name, currency).
 */
import { APP_NAME, COMPANY_NAME } from '@/constants/app';

export interface SettingSeed {
  settingKey: string;
  settingValue: unknown;
  category: string;
  description: string;
  isPublic: boolean;
}

export const SETTING_KEYS = {
  COMPANY_NAME: 'company.name',
  COMPANY_LEGAL_NAME: 'company.legal_name',
  COMPANY_GST_NUMBER: 'company.gst_number',
  COMPANY_PAN_NUMBER: 'company.pan_number',
  COMPANY_EMAIL: 'company.email',
  COMPANY_PHONE: 'company.phone',
  COMPANY_ADDRESS: 'company.address',
  COMPANY_STATE: 'company.state',
  COMPANY_LOGO: 'company.logo_url',
  FINANCE_CURRENCY: 'finance.currency',
  FINANCE_CURRENCY_SYMBOL: 'finance.currency_symbol',
  FINANCE_GST_DEFAULT: 'finance.default_gst_percentage',
  FINANCE_GST_ENABLED: 'finance.gst_enabled',
  FINANCE_INVOICE_DUE_DAYS: 'finance.invoice_due_days',
  NUMBERING_INVOICE_PREFIX: 'numbering.invoice_prefix',
  NUMBERING_QUOTATION_PREFIX: 'numbering.quotation_prefix',
  NUMBERING_PAYMENT_PREFIX: 'numbering.payment_prefix',
  NUMBERING_CUSTOMER_PREFIX: 'numbering.customer_prefix',
  NUMBERING_PRODUCT_PREFIX: 'numbering.product_prefix',
  SYSTEM_TIMEZONE: 'system.timezone',
  SYSTEM_DATE_FORMAT: 'system.date_format',
  SYSTEM_THEME: 'system.theme',
  SYSTEM_IDLE_TIMEOUT_MINUTES: 'system.idle_timeout_minutes',
  BACKUP_FREQUENCY: 'backup.frequency',
} as const;

export const DEFAULT_SYSTEM_SETTINGS: readonly SettingSeed[] = [
  {
    settingKey: SETTING_KEYS.COMPANY_NAME,
    settingValue: COMPANY_NAME,
    category: 'company',
    description: 'Display name of the company.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_LEGAL_NAME,
    settingValue: COMPANY_NAME,
    category: 'company',
    description: 'Registered legal name.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_GST_NUMBER,
    settingValue: '',
    category: 'company',
    description: 'Company GSTIN.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_PAN_NUMBER,
    settingValue: '',
    category: 'company',
    description: 'Company PAN.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_EMAIL,
    settingValue: '',
    category: 'company',
    description: 'Company contact email.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_PHONE,
    settingValue: '',
    category: 'company',
    description: 'Company contact phone.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_ADDRESS,
    settingValue: '',
    category: 'company',
    description: 'Company registered address.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_STATE,
    settingValue: '',
    category: 'company',
    description: 'Company state (for GST intra/inter-state).',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.COMPANY_LOGO,
    settingValue: '',
    category: 'company',
    description: 'Company logo URL.',
    isPublic: true,
  },

  {
    settingKey: SETTING_KEYS.FINANCE_CURRENCY,
    settingValue: 'INR',
    category: 'finance',
    description: 'Base currency (ISO 4217).',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.FINANCE_CURRENCY_SYMBOL,
    settingValue: '₹',
    category: 'finance',
    description: 'Currency symbol.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.FINANCE_GST_DEFAULT,
    settingValue: 18,
    category: 'finance',
    description: 'Default GST percentage for new items.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.FINANCE_GST_ENABLED,
    settingValue: true,
    category: 'finance',
    description: 'Whether GST is applied.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.FINANCE_INVOICE_DUE_DAYS,
    settingValue: 15,
    category: 'finance',
    description: 'Default invoice due period in days.',
    isPublic: false,
  },

  {
    settingKey: SETTING_KEYS.NUMBERING_INVOICE_PREFIX,
    settingValue: 'INV',
    category: 'numbering',
    description: 'Invoice number prefix.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.NUMBERING_QUOTATION_PREFIX,
    settingValue: 'QT',
    category: 'numbering',
    description: 'Quotation number prefix.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.NUMBERING_PAYMENT_PREFIX,
    settingValue: 'PAY',
    category: 'numbering',
    description: 'Payment number prefix.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.NUMBERING_CUSTOMER_PREFIX,
    settingValue: 'CUS',
    category: 'numbering',
    description: 'Customer code prefix.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.NUMBERING_PRODUCT_PREFIX,
    settingValue: 'PRD',
    category: 'numbering',
    description: 'Product code prefix.',
    isPublic: false,
  },

  {
    settingKey: SETTING_KEYS.SYSTEM_TIMEZONE,
    settingValue: 'Asia/Kolkata',
    category: 'system',
    description: 'Application timezone.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.SYSTEM_DATE_FORMAT,
    settingValue: 'dd MMM yyyy',
    category: 'system',
    description: 'Display date format.',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.SYSTEM_THEME,
    settingValue: 'system',
    category: 'system',
    description: 'Default theme (light/dark/system).',
    isPublic: true,
  },
  {
    settingKey: SETTING_KEYS.SYSTEM_IDLE_TIMEOUT_MINUTES,
    settingValue: 30,
    category: 'system',
    description: 'Idle session timeout in minutes.',
    isPublic: false,
  },
  {
    settingKey: SETTING_KEYS.BACKUP_FREQUENCY,
    settingValue: 'daily',
    category: 'backup',
    description: 'Automatic backup frequency.',
    isPublic: false,
  },
];

/** Metadata for context; not itself a setting default. */
export const APP_DISPLAY_NAME = APP_NAME;
