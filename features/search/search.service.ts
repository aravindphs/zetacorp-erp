import 'server-only';

/**
 * Global search across modules (spec §93). Every entity is queried only if the
 * user holds its view permission, and results are capped per group to stay
 * fast. Returns a flat, grouped, navigable result set for the command palette.
 */
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth/guards';
import type { AuthUser } from '@/types/auth';

export interface SearchResultItem {
  id: string;
  type: string;
  label: string;
  sublabel: string;
  href: string;
}

export interface SearchResultGroup {
  type: string;
  heading: string;
  items: SearchResultItem[];
}

const PER_GROUP = 5;
const insensitive = 'insensitive' as const;

export async function globalSearch(user: AuthUser, query: string): Promise<SearchResultGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: insensitive };
  const groups: SearchResultGroup[] = [];

  const [customers, products, invoices, quotations, payments, employees, announcements] =
    await Promise.all([
      hasPermission(user, 'customer.view')
        ? prisma.customer.findMany({
            where: {
              isDeleted: false,
              OR: [{ customerName: contains }, { customerCode: contains }, { phone: contains }],
            },
            select: { id: true, customerName: true, customerCode: true },
            take: PER_GROUP,
          })
        : Promise.resolve([]),
      hasPermission(user, 'inventory.view')
        ? prisma.product.findMany({
            where: {
              isDeleted: false,
              OR: [{ productName: contains }, { productCode: contains }],
            },
            select: { id: true, productName: true, productCode: true },
            take: PER_GROUP,
          })
        : Promise.resolve([]),
      hasPermission(user, 'invoice.view')
        ? prisma.invoice.findMany({
            where: { isDeleted: false, invoiceNumber: contains },
            select: { id: true, invoiceNumber: true, customer: { select: { customerName: true } } },
            take: PER_GROUP,
          })
        : Promise.resolve([]),
      hasPermission(user, 'quotation.view')
        ? prisma.quotation.findMany({
            where: { isDeleted: false, quotationNumber: contains },
            select: {
              id: true,
              quotationNumber: true,
              customer: { select: { customerName: true } },
            },
            take: PER_GROUP,
          })
        : Promise.resolve([]),
      hasPermission(user, 'payment.view')
        ? prisma.payment.findMany({
            where: { isDeleted: false, paymentNumber: contains },
            select: { id: true, paymentNumber: true, customer: { select: { customerName: true } } },
            take: PER_GROUP,
          })
        : Promise.resolve([]),
      hasPermission(user, 'employee.view')
        ? prisma.user.findMany({
            where: {
              isDeleted: false,
              OR: [{ fullName: contains }, { employeeCode: contains }, { email: contains }],
            },
            select: { id: true, fullName: true, employeeCode: true },
            take: PER_GROUP,
          })
        : Promise.resolve([]),
      hasPermission(user, 'announcement.view')
        ? prisma.announcement.findMany({
            where: { isDeleted: false, title: contains },
            select: { id: true, title: true },
            take: PER_GROUP,
          })
        : Promise.resolve([]),
    ]);

  if (customers.length)
    groups.push({
      type: 'customer',
      heading: 'Customers',
      items: customers.map((c) => ({
        id: c.id,
        type: 'customer',
        label: c.customerName,
        sublabel: c.customerCode,
        href: `/customers/${c.id}`,
      })),
    });

  if (products.length)
    groups.push({
      type: 'product',
      heading: 'Products',
      items: products.map((p) => ({
        id: p.id,
        type: 'product',
        label: p.productName,
        sublabel: p.productCode,
        href: `/inventory/${p.id}`,
      })),
    });

  if (invoices.length)
    groups.push({
      type: 'invoice',
      heading: 'Invoices',
      items: invoices.map((i) => ({
        id: i.id,
        type: 'invoice',
        label: i.invoiceNumber,
        sublabel: i.customer.customerName,
        href: `/invoices/${i.id}`,
      })),
    });

  if (quotations.length)
    groups.push({
      type: 'quotation',
      heading: 'Quotations',
      items: quotations.map((qt) => ({
        id: qt.id,
        type: 'quotation',
        label: qt.quotationNumber,
        sublabel: qt.customer.customerName,
        href: `/quotations/${qt.id}`,
      })),
    });

  if (payments.length)
    groups.push({
      type: 'payment',
      heading: 'Payments',
      items: payments.map((p) => ({
        id: p.id,
        type: 'payment',
        label: p.paymentNumber,
        sublabel: p.customer.customerName,
        href: `/payments/${p.id}`,
      })),
    });

  if (employees.length)
    groups.push({
      type: 'employee',
      heading: 'Employees',
      items: employees.map((e) => ({
        id: e.id,
        type: 'employee',
        label: e.fullName,
        sublabel: e.employeeCode,
        href: `/employees/${e.id}`,
      })),
    });

  if (announcements.length)
    groups.push({
      type: 'announcement',
      heading: 'Announcements',
      items: announcements.map((a) => ({
        id: a.id,
        type: 'announcement',
        label: a.title,
        sublabel: 'Announcement',
        href: `/announcements`,
      })),
    });

  return groups;
}
