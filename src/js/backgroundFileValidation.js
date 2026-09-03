const BACKGROUND_TYPES = Object.freeze({
  avif: { mime: 'image/avif', kind: 'image' },
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  gif: { mime: 'image/gif', kind: 'image' },
  png: { mime: 'image/png', kind: 'image' },
  svg: { mime: 'image/svg+xml', kind: 'image' },
  mp4: { mime: 'video/mp4', kind: 'video' }
});

export const FILES_ALLOWED_EXTENSIONS = Object.freeze(Object.keys(BACKGROUND_TYPES));
export const MAX_FILE_SIZE_BYTES = 50_000_000;

export function validateBackgroundFile({ name = '', type = '', size = 0 } = {}) {
  const nameParts = String(name).trim().toLowerCase().split('.');
  const extension = nameParts.length > 1 ? nameParts.at(-1) : '';
  const mime = String(type).trim().toLowerCase();
  const definition = BACKGROUND_TYPES[extension];
  const hasDisguisedKnownExtension = nameParts
    .slice(1, -1)
    .some(part => Object.hasOwn(BACKGROUND_TYPES, part));

  if (!definition || !mime || definition.mime !== mime || hasDisguisedKnownExtension) {
    return { ok: false, reason: 'type' };
  }
  if (Number(size) > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: 'size' };
  }
  return {
    ok: true,
    extension,
    mime,
    kind: definition.kind
  };
}

export function createBackgroundPreview({
  blob,
  file,
  validation,
  resizeImage,
  getVideoPoster
}) {
  if (validation.kind === 'video') return getVideoPoster(file);
  if (validation.mime === 'image/svg+xml') return Promise.resolve(blob);
  return resizeImage(blob);
}

export async function commitBackgroundUpload({
  record,
  persist,
  createObjectURL,
  previousObjectURL,
  revokeObjectURL,
  apply,
  rollback,
  reportError
}) {
  let nextObjectURL;
  const fail = error => {
    try {
      reportError?.(error);
    } catch {
      // Reporting cannot turn a handled persistence failure into a rejection.
    }
    return { ok: false, reason: 'persist', ...(error && { error }) };
  };
  try {
    const persisted = await persist(record);
    if (persisted === undefined || persisted === false) {
      return fail();
    }

    nextObjectURL = createObjectURL(record.blobThumbnail);
    try {
      apply(nextObjectURL);
    } catch (error) {
      try {
        await rollback?.();
      } catch {
        // Keep the original apply failure while still releasing the new URL.
      }
      throw error;
    }
    if (previousObjectURL) {
      try {
        revokeObjectURL(previousObjectURL);
      } catch {
        // The committed preview remains valid even if old-URL cleanup fails.
      }
    }
    return { ok: true, objectURL: nextObjectURL };
  } catch (error) {
    if (nextObjectURL) {
      try {
        revokeObjectURL(nextObjectURL);
      } catch {
        // The original persistence/UI failure remains authoritative.
      }
    }
    return fail(error);
  }
}

export const BACKGROUND_FILE_TYPES = BACKGROUND_TYPES;
