import { type StorageBucket, getStoragePath } from '../constants/storage';

/**
 * Generate a unique upload path for a file in Supabase Storage.
 * Pattern: {communityId}/{category}/{timestamp}-{random}.{ext}
 *
 * The bucket is passed separately to supabase.storage.from(bucket).
 * This function generates the object path within that bucket.
 */
export function generateUploadPath(
  bucket: StorageBucket,
  communityId: string,
  category: string,
  filename: string
): string {
  const ext = filename.split('.').pop() ?? 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return getStoragePath(
    bucket,
    communityId,
    `${category}/${timestamp}-${random}.${ext}`
  );
}

/**
 * Derive MIME content type from filename extension.
 * Falls back to application/octet-stream for unknown types.
 */
export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
  };
  return types[ext ?? ''] ?? 'application/octet-stream';
}
