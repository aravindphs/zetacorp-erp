/**
 * Shared API contract types (spec §63, §379, §380).
 * Every JSON endpoint returns one of these envelopes — never a bare payload.
 */

/** A single field-level or general error surfaced to the client. */
export interface ApiError {
  /** Dotted path of the offending field, when applicable (e.g. "customer.email"). */
  field?: string;
  /** Human-readable, non-technical message. */
  message: string;
  /** Machine-readable code for programmatic handling (e.g. "DUPLICATE_EMAIL"). */
  code?: string;
}

export interface ApiSuccess<TData> {
  success: true;
  message: string;
  data: TData;
  meta?: PaginationMeta;
  timestamp: string;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors: ApiError[];
  timestamp: string;
  requestId: string;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

/** Pagination envelope returned alongside list endpoints. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Normalised, validated pagination/sort/search input for list queries. */
export interface ListParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

/** A page of results plus its total count, as returned by repositories. */
export interface Paginated<TItem> {
  items: TItem[];
  totalItems: number;
}
