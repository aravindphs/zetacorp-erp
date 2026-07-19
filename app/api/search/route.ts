import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requireUser } from '@/lib/auth/guards';
import { globalSearch } from '@/features/search/search.service';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, requestId) => {
  const user = await requireUser();
  const query = new URL(request.url).searchParams.get('q') ?? '';
  const groups = await globalSearch(user, query);
  return apiSuccess(groups, { message: 'Search results', requestId });
});
