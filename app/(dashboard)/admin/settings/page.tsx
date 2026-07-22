import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getSettingValues } from '@/features/admin/admin.queries';
import { SettingsForm } from '@/features/admin/components/settings-form';
import {
  updateCompanyProfileAction,
  updateFinancialConfigAction,
  updateGstSettingsAction,
  updatePreferencesAction,
  updateSecuritySettingsAction,
} from '@/features/admin/admin.actions';

export const metadata: Metadata = { title: 'System Settings' };

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export default async function AdminSettingsPage() {
  const user = await requirePermission('settings.view');
  const canManage = hasPermission(user, 'settings.manage');

  // One cached read serves every panel below.
  const s = await getSettingValues([
    'company.name',
    'company.legal_name',
    'company.gst_number',
    'company.pan_number',
    'company.cin',
    'company.address',
    'company.city',
    'company.state',
    'company.country',
    'company.postal_code',
    'company.phone',
    'company.email',
    'company.website',
    'company.signatory_name',
    'financial.year_start',
    'financial.currency',
    'financial.currency_symbol',
    'financial.decimal_precision',
    'financial.timezone',
    'financial.date_format',
    'gst.default_gstin',
    'gst.default_place_of_supply',
    'gst.reverse_charge_default',
    'gst.default_percentage',
    'security.password_min_length',
    'security.require_strong_passwords',
    'security.session_timeout_minutes',
    'security.max_login_attempts',
    'security.account_lock_minutes',
    'preferences.default_landing_page',
    'preferences.items_per_page',
    'preferences.system_notifications',
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="System settings"
        description="Company profile, financial configuration, GST defaults, and security policy."
      />

      <SettingsForm
        title="Company profile"
        description="Printed on invoices, quotations, and receipts."
        canManage={canManage}
        action={updateCompanyProfileAction}
        initialValues={{
          name: str(s['company.name']),
          legalName: str(s['company.legal_name']),
          gstNumber: str(s['company.gst_number']),
          panNumber: str(s['company.pan_number']),
          cin: str(s['company.cin']),
          address: str(s['company.address']),
          city: str(s['company.city']),
          state: str(s['company.state']),
          country: str(s['company.country'], 'India'),
          postalCode: str(s['company.postal_code']),
          phone: str(s['company.phone']),
          email: str(s['company.email']),
          website: str(s['company.website']),
          signatoryName: str(s['company.signatory_name']),
        }}
        fields={[
          { name: 'name', label: 'Company name' },
          { name: 'legalName', label: 'Legal name' },
          { name: 'gstNumber', label: 'GSTIN', hint: '15 characters' },
          { name: 'panNumber', label: 'PAN' },
          { name: 'cin', label: 'CIN' },
          { name: 'signatoryName', label: 'Authorised signatory' },
          { name: 'address', label: 'Address', type: 'textarea' },
          { name: 'city', label: 'City' },
          { name: 'state', label: 'State', hint: 'Drives CGST/SGST vs IGST' },
          { name: 'country', label: 'Country' },
          { name: 'postalCode', label: 'PIN code' },
          { name: 'phone', label: 'Phone' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'website', label: 'Website' },
        ]}
      />

      <SettingsForm
        title="Financial configuration"
        canManage={canManage}
        action={updateFinancialConfigAction}
        initialValues={{
          financialYearStart: str(s['financial.year_start'], '04-01'),
          currency: str(s['financial.currency'], 'INR'),
          currencySymbol: str(s['financial.currency_symbol'], '₹'),
          decimalPrecision: num(s['financial.decimal_precision'], 2),
          timezone: str(s['financial.timezone'], 'Asia/Kolkata'),
          dateFormat: str(s['financial.date_format'], 'dd MMM yyyy'),
        }}
        fields={[
          { name: 'financialYearStart', label: 'Financial year start', hint: 'MM-DD, e.g. 04-01' },
          { name: 'currency', label: 'Currency' },
          { name: 'currencySymbol', label: 'Currency symbol' },
          { name: 'decimalPrecision', label: 'Decimal precision', type: 'number' },
          { name: 'timezone', label: 'Timezone' },
          { name: 'dateFormat', label: 'Date format' },
        ]}
      />

      <SettingsForm
        title="GST defaults"
        description="Applied to new invoices and quotations."
        canManage={canManage}
        action={updateGstSettingsAction}
        initialValues={{
          defaultGstin: str(s['gst.default_gstin']),
          defaultPlaceOfSupply: str(s['gst.default_place_of_supply']),
          reverseChargeDefault: bool(s['gst.reverse_charge_default'], false),
          defaultGstPercentage: num(s['gst.default_percentage'], 18),
        }}
        fields={[
          { name: 'defaultGstin', label: 'Default GSTIN' },
          { name: 'defaultPlaceOfSupply', label: 'Default place of supply' },
          { name: 'defaultGstPercentage', label: 'Default GST %', type: 'number' },
          { name: 'reverseChargeDefault', label: 'Reverse charge by default', type: 'switch' },
        ]}
      />

      <SettingsForm
        title="Security policy"
        canManage={canManage}
        action={updateSecuritySettingsAction}
        initialValues={{
          passwordMinLength: num(s['security.password_min_length'], 12),
          requireStrongPasswords: bool(s['security.require_strong_passwords'], true),
          sessionTimeoutMinutes: num(s['security.session_timeout_minutes'], 60),
          maxLoginAttempts: num(s['security.max_login_attempts'], 5),
          accountLockMinutes: num(s['security.account_lock_minutes'], 15),
        }}
        fields={[
          { name: 'passwordMinLength', label: 'Minimum password length', type: 'number' },
          { name: 'sessionTimeoutMinutes', label: 'Session timeout (minutes)', type: 'number' },
          { name: 'maxLoginAttempts', label: 'Max login attempts', type: 'number' },
          { name: 'accountLockMinutes', label: 'Account lock (minutes)', type: 'number' },
          {
            name: 'requireStrongPasswords',
            label: 'Require strong passwords',
            type: 'switch',
            wide: true,
          },
        ]}
      />

      <SettingsForm
        title="Preferences"
        canManage={canManage}
        action={updatePreferencesAction}
        initialValues={{
          defaultLandingPage: str(s['preferences.default_landing_page'], '/dashboard'),
          itemsPerPage: num(s['preferences.items_per_page'], 20),
          systemNotifications: bool(s['preferences.system_notifications'], true),
        }}
        fields={[
          { name: 'defaultLandingPage', label: 'Default landing page' },
          { name: 'itemsPerPage', label: 'Items per page', type: 'number' },
          {
            name: 'systemNotifications',
            label: 'System notifications enabled',
            type: 'switch',
            wide: true,
          },
        ]}
      />
    </div>
  );
}
