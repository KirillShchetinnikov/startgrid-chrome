/* global ImageDecoder */
import ImageDB from './api/imageDB';
import { getBingImage } from './api/bingImageDay';
import { normalizeBackgroundImageURL } from './backgroundUrlValidation';

export const FAST_BACKGROUND_MAX_BYTES = 20 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const CACHE_VERSION = 1;
const RETRY_DELAY = 10 * 60 * 1000;

export class FastBackgroundError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function downloadBackground(url, fetchImage = fetch) {
  if (!normalizeBackgroundImageURL(url)) throw new FastBackgroundError('download');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetchImage(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok || response.type === 'opaque') throw new FastBackgroundError('download');
    // Respect origins which explicitly forbid caching their content.
    if (/\bno-store\b/i.test(response.headers.get('cache-control') || '')) {
      throw new FastBackgroundError('cache');
    }
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES.has(type)) throw new FastBackgroundError('format');
    if (Number(response.headers.get('content-length')) > FAST_BACKGROUND_MAX_BYTES) {
      throw new FastBackgroundError('size');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (!controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > FAST_BACKGROUND_MAX_BYTES) {
        await reader.cancel();
        throw new FastBackgroundError('size');
      }
      chunks.push(value);
    }
    controller.signal.throwIfAborted();
    return new Blob(chunks, { type });
  } catch (error) {
    if (error instanceof FastBackgroundError) throw error;
    throw new FastBackgroundError('download');
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}

export async function prepareFastBackground(blob) {
  if (!TYPES.has(blob.type) || typeof ImageDecoder === 'undefined'
    || !await ImageDecoder.isTypeSupported(blob.type)) throw new FastBackgroundError('format');
  const decoder = new ImageDecoder({
    data: await blob.arrayBuffer(), type: blob.type, preferAnimation: true
  });
  let frame;
  try {
    await decoder.tracks.ready;
    await decoder.completed;
    for (let index = 0; index < decoder.tracks.length; index++) {
      const track = decoder.tracks[index];
      if (track.animated || track.frameCount > 1) throw new FastBackgroundError('animated');
    }
    frame = (await decoder.decode({ frameIndex: 0, completeFramesOnly: true })).image;
    const width = frame.displayWidth;
    const height = frame.displayHeight;
    if (width * height > 32 * 1024 * 1024) throw new FastBackgroundError('size');
    const scale = Math.min(1, 1920 / width, 1080 / height);
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    canvas.getContext('2d').drawImage(frame, 0, 0, canvas.width, canvas.height);
    return await canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
  } catch (error) {
    if (error instanceof FastBackgroundError) throw error;
    throw new FastBackgroundError('format');
  } finally {
    frame?.close();
    decoder.close();
  }
}

// One bounded record per source. Web Locks serialize cache fills across tabs.
export function createFastBackgroundCache({ read, write, resolveBing, download, prepare, lock, now = Date.now }) {
  return (source, inputUrl = '') => lock(`startgrid-fast-background-${source}`, async() => {
    const id = `background-cache-${source}`;
    const cached = await read(id);
    const valid = cached?.version === CACHE_VERSION && cached?.blob;
    if (valid && (source === 'url' ? cached.url === inputUrl : cached.expiresAt > now())) return cached;
    try {
      const bing = source === 'bing' ? await resolveBing() : null;
      const url = source === 'bing' ? bing?.imageurl : normalizeBackgroundImageURL(inputUrl);
      if (!url) throw new FastBackgroundError('download');
      const blob = valid && cached.url === url ? cached.blob : await prepare(await download(url));
      const record = { id, version: CACHE_VERSION, url, blob,
        expiresAt: source === 'bing' ? bing.expiresAt : null };
      const result = await write(record);
      if (result === undefined || result === false) throw new FastBackgroundError('cache');
      return record;
    } catch (error) {
      if (source === 'bing' && valid) {
        const fallback = { ...cached, expiresAt: now() + RETRY_DELAY };
        await write(fallback);
        return fallback;
      }
      if (error instanceof FastBackgroundError) throw error;
      throw new FastBackgroundError('cache');
    }
  });
}

export const getFastBackground = createFastBackgroundCache({
  read: id => ImageDB.get(id),
  write: record => ImageDB.update(record),
  resolveBing: () => getBingImage({ fast: true }),
  download: downloadBackground,
  prepare: prepareFastBackground,
  lock: (name, operation) => navigator.locks.request(name, operation)
});
