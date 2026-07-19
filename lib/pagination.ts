/**
 * Pagination helpers shared by every list endpoint (spec §11, §379).
 */
import type { ListParams, PaginationMeta } from '@/types/api';
import { listQuerySchema } from '@/schemas/common';

/** Parse and validate list/pagination params from a request URL. */
export function parseListParams(url: string): ListParams {
  const { searchParams } = new URL(url);
  const parsed = listQuerySchema.parse({
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    sortBy: searchParams.get('sortBy') ?? undefined,
    sortOrder: searchParams.get('sortOrder') ?? undefined,
  });
  return parsed;
}

/** Compute the Prisma `skip` offset for a page. */
export function toSkip(params: Pick<ListParams, 'page' | 'pageSize'>): number {
  return (params.page - 1) * params.pageSize;
}

/** Build the pagination metadata envelope from a total count. */
export function buildPaginationMeta(
  params: Pick<ListParams, 'page' | 'pageSize'>,
  totalItems: number,
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalItems / params.pageSize));
  return {
    page: params.page,
    pageSize: params.pageSize,
    totalItems,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
}
