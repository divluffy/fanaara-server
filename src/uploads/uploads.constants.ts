export const UPLOAD_TOKEN_PREFIX = 'uploads:token:';

export type UploadPurpose = 'avatar' | 'post_image' | 'cover' | 'attachment';

export const PURPOSES_SYNC: UploadPurpose[] = ['avatar', 'cover'];

export function isSyncPurpose(p: UploadPurpose) {
  return PURPOSES_SYNC.includes(p);
}

export const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const MAX_AVATAR_BYTES = Number(
  process.env.MAX_AVATAR_BYTES ?? 3_000_000,
);
export const MAX_POST_IMAGE_BYTES = Number(
  process.env.MAX_POST_IMAGE_BYTES ?? 8_000_000,
);
