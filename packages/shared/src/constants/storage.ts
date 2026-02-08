export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  COMMUNITY_ASSETS: 'community-assets',
  CHAT_MEDIA: 'chat-media',
  TICKET_ATTACHMENTS: 'ticket-attachments',
  INCIDENT_EVIDENCE: 'incident-evidence',
  PAYMENT_PROOFS: 'payment-proofs',
  DOCUMENT_FILES: 'document-files',
  RESIDENT_DOCUMENTS: 'resident-documents',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export function getStoragePath(
  bucket: StorageBucket,
  communityId: string,
  ...segments: string[]
): string {
  return [communityId, ...segments].join('/');
}

export function getAvatarPath(userId: string, filename: string): string {
  return `${userId}/${filename}`;
}
