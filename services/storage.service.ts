import 'server-only';

/**
 * Supabase Storage access (spec §71, §255). The bucket is PRIVATE: nothing is
 * ever served by public URL. Files are written with the service-role client and
 * read back through short-lived signed URLs, so object paths are the only thing
 * persisted in the database.
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env';
import { BusinessRuleError } from '@/lib/errors';

/** Default signed-URL lifetime: long enough to open, short enough to not leak. */
const SIGNED_URL_TTL_SECONDS = 60 * 5;

function bucket() {
  return serverEnv().SUPABASE_STORAGE_BUCKET;
}

/** Strip anything that could escape the intended folder or confuse storage. */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120);
}

export async function uploadFile(
  path: string,
  file: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(bucket())
    .upload(path, file, { contentType, upsert: false });

  if (error) {
    // The bucket is created manually in the Supabase dashboard; make that
    // failure mode obvious rather than surfacing a raw storage error.
    if (/bucket not found/i.test(error.message)) {
      throw new BusinessRuleError(
        `Storage bucket "${bucket()}" does not exist. Create it (private) in Supabase Storage.`,
      );
    }
    throw new BusinessRuleError(`Upload failed: ${error.message}`);
  }
}

/** Time-limited read URL for a private object (§255 "signed URLs only"). */
export async function createSignedUrl(
  path: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket()).createSignedUrl(path, expiresIn);
  if (error || !data) throw new BusinessRuleError(`Could not create a download link: ${error?.message}`);
  return data.signedUrl;
}

export async function removeFile(path: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket()).remove([path]);
  if (error) throw new BusinessRuleError(`Could not remove the file: ${error.message}`);
}
