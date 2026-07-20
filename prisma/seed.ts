/**
 * Idempotent database seed (spec — bootstrap requirement).
 *
 * Safe to run repeatedly: every step upserts by a natural key. Seeds:
 *   1. Permissions (the full catalogue)
 *   2. Roles (Admin / Manager / Staff, flagged as system roles)
 *   3. Role → permission grants (authoritative: reset to the defined set)
 *   4. Leave types
 *   5. Expense categories
 *   6. Default system settings (incl. GST settings)
 *   7. The default Admin account (Supabase Auth user + users row)
 *
 * Run with: `pnpm db:seed`
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PERMISSION_DEFINITIONS } from '@/constants/permissions';
import { ROLE_DEFINITIONS, ROLE_NAMES, permissionsForRole } from '@/constants/roles';
import { DEFAULT_LEAVE_TYPES } from '@/constants/leave-types';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/constants/expense-categories';
import { DEFAULT_SYSTEM_SETTINGS } from '@/constants/settings';

const prisma = new PrismaClient();

function log(step: string): void {
  console.log(`  ✓ ${step}`);
}

async function seedPermissions(): Promise<Map<string, string>> {
  for (const p of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: { key: p.key, module: p.module, action: p.action, description: p.description },
    });
  }
  const all = await prisma.permission.findMany({ select: { id: true, key: true } });
  log(`Permissions (${all.length})`);
  return new Map(all.map((p) => [p.key, p.id]));
}

async function seedRoles(permissionIdByKey: Map<string, string>): Promise<Map<string, string>> {
  const roleIdByName = new Map<string, string>();

  for (const role of ROLE_DEFINITIONS) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystemRole: role.isSystemRole },
      create: { name: role.name, description: role.description, isSystemRole: role.isSystemRole },
    });
    roleIdByName.set(role.name, record.id);

    // Authoritatively reset this system role's grants to the defined set.
    const keys = permissionsForRole(role);
    const permissionIds = keys
      .map((k) => permissionIdByKey.get(k))
      .filter((id): id is string => Boolean(id));

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: record.id } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: record.id, permissionId })),
        skipDuplicates: true,
      }),
    ]);
    log(`Role "${role.name}" with ${permissionIds.length} permissions`);
  }

  return roleIdByName;
}

async function seedLeaveTypes(): Promise<void> {
  for (const lt of DEFAULT_LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {
        name: lt.name,
        description: lt.description,
        isPaid: lt.isPaid,
        requiresDocument: lt.requiresDocument,
      },
      create: {
        name: lt.name,
        code: lt.code,
        description: lt.description,
        isPaid: lt.isPaid,
        requiresDocument: lt.requiresDocument,
      },
    });
  }
  log(`Leave types (${DEFAULT_LEAVE_TYPES.length})`);
}

async function seedExpenseCategories(): Promise<void> {
  for (const c of DEFAULT_EXPENSE_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: { name: c.name, description: c.description },
    });
  }
  log(`Expense categories (${DEFAULT_EXPENSE_CATEGORIES.length})`);
}

async function seedSystemSettings(): Promise<void> {
  for (const s of DEFAULT_SYSTEM_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { settingKey: s.settingKey },
      // Only backfill metadata; never clobber an admin-edited value on re-seed.
      update: { category: s.category, description: s.description, isPublic: s.isPublic },
      create: {
        settingKey: s.settingKey,
        settingValue: s.settingValue as never,
        category: s.category,
        description: s.description,
        isPublic: s.isPublic,
      },
    });
  }
  log(`System settings (${DEFAULT_SYSTEM_SETTINGS.length})`);
}

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to seed the admin account.',
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureAuthUser(email: string, password: string, fullName: string): Promise<string> {
  const supabase = getAdminSupabase();

  // Look for an existing auth user with this email (idempotency).
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error('Failed to create the admin auth user.');
  return data.user.id;
}

/** Default departments (§252). Admins can add unlimited more at runtime. */
async function seedDepartments(): Promise<Map<string, string>> {
  const names = ['Administration', 'Sales', 'Inventory', 'Accounts', 'Management'];
  const idByName = new Map<string, string>();
  for (const name of names) {
    const row = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
      select: { id: true, name: true },
    });
    idByName.set(row.name, row.id);
  }
  log(`Departments (${names.length})`);
  return idByName;
}

/** Default designations (§253). Admins can add unlimited more at runtime. */
async function seedDesignations(): Promise<Map<string, string>> {
  const names = [
    'Administrator',
    'Manager',
    'Sales Executive',
    'Inventory Executive',
    'Office Staff',
  ];
  const idByName = new Map<string, string>();
  for (const name of names) {
    const row = await prisma.designation.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
      select: { id: true, name: true },
    });
    idByName.set(row.name, row.id);
  }
  log(`Designations (${names.length})`);
  return idByName;
}

async function seedAdminUser(
  roleIdByName: Map<string, string>,
  departmentIdByName: Map<string, string>,
  designationIdByName: Map<string, string>,
): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@nsquare.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin123';
  const fullName = process.env.SEED_ADMIN_NAME ?? 'System Administrator';

  const adminRoleId = roleIdByName.get(ROLE_NAMES.ADMIN);
  if (!adminRoleId) throw new Error('Admin role missing — seed roles before the admin user.');

  const authUserId = await ensureAuthUser(email, password, fullName);

  await prisma.user.upsert({
    where: { id: authUserId },
    update: {
      fullName,
      email: email.toLowerCase(),
      roleId: adminRoleId,
      status: 'ACTIVE',
      // Keep the catalogue links correct on re-seed (§252, §253).
      designationId: designationIdByName.get('Administrator'),
      departmentId: departmentIdByName.get('Management'),
    },
    create: {
      id: authUserId,
      employeeCode: 'EMP-000001',
      fullName,
      email: email.toLowerCase(),
      passwordManagedBySupabase: true,
      roleId: adminRoleId,
      designationId: designationIdByName.get('Administrator'),
      departmentId: departmentIdByName.get('Management'),
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      joiningDate: new Date(),
    },
  });
  // The admin's code is hardcoded above, so the shared `employee` sequence must
  // be advanced past it — otherwise the first employee created through the UI
  // would generate EMP-000001 again and hit the unique constraint.
  await prisma.$executeRawUnsafe(
    `INSERT INTO number_sequences (key, prefix, padding, next_value)
     VALUES ('employee', 'EMP', 6, 2)
     ON CONFLICT (key) DO UPDATE SET next_value = GREATEST(number_sequences.next_value, 2)`,
  );

  log(`Admin account (${email})`);
}

async function main(): Promise<void> {
  console.log('Seeding NSquare ERP…');

  const permissionIdByKey = await seedPermissions();
  const roleIdByName = await seedRoles(permissionIdByKey);
  const departmentIdByName = await seedDepartments();
  const designationIdByName = await seedDesignations();
  await seedLeaveTypes();
  await seedExpenseCategories();
  await seedSystemSettings();

  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    await seedAdminUser(roleIdByName, departmentIdByName, designationIdByName);
  } else {
    console.warn('  ! Skipped admin account: Supabase credentials not configured.');
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
