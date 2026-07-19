'use client';

/**
 * URL-synchronised table state (spec §11, §379). List pages are Server
 * Components that read these params from the URL and fetch the matching page
 * server-side, so pagination/sorting/search are shareable, bookmarkable, and
 * enforced on the backend (never trust the client with the full dataset).
 */
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PAGINATION } from '@/constants/app';

export type SortOrder = 'asc' | 'desc';

export interface DataTableParams {
  page: number;
  pageSize: number;
  search: string;
  sortBy: string | null;
  sortOrder: SortOrder;
}

export function useDataTableParams(): DataTableParams & {
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  toggleSort: (columnId: string) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Number(searchParams.get('pageSize') ?? PAGINATION.DEFAULT_PAGE_SIZE);
  const search = searchParams.get('search') ?? '';
  const sortBy = searchParams.get('sortBy');
  const sortOrder: SortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      commit((p) => {
        if (value) p.set('search', value);
        else p.delete('search');
        p.set('page', '1'); // reset to first page on new search
      });
    },
    [commit],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      commit((p) => p.set('page', String(Math.max(1, nextPage))));
    },
    [commit],
  );

  const toggleSort = useCallback(
    (columnId: string) => {
      commit((p) => {
        const currentBy = p.get('sortBy');
        const currentOrder = p.get('sortOrder') === 'asc' ? 'asc' : 'desc';
        if (currentBy !== columnId) {
          p.set('sortBy', columnId);
          p.set('sortOrder', 'asc');
        } else if (currentOrder === 'asc') {
          p.set('sortOrder', 'desc');
        } else {
          p.delete('sortBy');
          p.delete('sortOrder');
        }
        p.set('page', '1');
      });
    },
    [commit],
  );

  return { page, pageSize, search, sortBy, sortOrder, setSearch, setPage, toggleSort };
}
