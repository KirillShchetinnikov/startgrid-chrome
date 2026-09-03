import { describe, expect, it, jest } from '@jest/globals';
import {
  commitBackgroundUpload,
  createBackgroundPreview,
  FILES_ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  validateBackgroundFile
} from '../src/js/backgroundFileValidation';

describe('local background file validation', () => {
  it.each([
    ['photo.avif', 'image/avif', 'image'],
    ['photo.jpg', 'image/jpeg', 'image'],
    ['photo.JPEG', 'IMAGE/JPEG', 'image'],
    ['photo.webp', 'image/webp', 'image'],
    ['photo.gif', 'image/gif', 'image'],
    ['photo.png', 'image/png', 'image'],
    ['photo.svg', 'image/svg+xml', 'image'],
    ['clip.mp4', 'video/mp4', 'video']
  ])('accepts %s only with its matching MIME', (name, type, kind) => {
    expect(validateBackgroundFile({ name, type, size: MAX_FILE_SIZE_BYTES }))
      .toMatchObject({ ok: true, kind });
  });

  it.each([
    { name: 'photo.svg', type: 'image/svg' },
    { name: 'photo.svg', type: 'image/png' },
    { name: 'photo.png.svg', type: 'image/png' },
    { name: 'photo.png.svg', type: 'image/svg+xml' },
    { name: 'photo', type: 'image/png' },
    { name: 'photo.png', type: '' },
    { name: 'photo.exe', type: 'image/png' }
  ])('rejects missing, unsupported, or mismatched input %#', file => {
    expect(validateBackgroundFile(file)).toEqual({ ok: false, reason: 'type' });
  });

  it('uses an inclusive 50 MB limit and exports the picker allowlist', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(50_000_000);
    expect(FILES_ALLOWED_EXTENSIONS).toContain('svg');
    expect(validateBackgroundFile({
      name: 'photo.png',
      type: 'image/png',
      size: MAX_FILE_SIZE_BYTES + 1
    })).toEqual({ ok: false, reason: 'size' });
  });

  it('uses the validated SVG blob directly without bitmap decoding', async() => {
    const blob = { type: 'image/svg+xml' };
    const resizeImage = jest.fn();
    const getVideoPoster = jest.fn();

    await expect(createBackgroundPreview({
      blob,
      file: { name: 'background.svg' },
      validation: { kind: 'image', mime: 'image/svg+xml' },
      resizeImage,
      getVideoPoster
    })).resolves.toBe(blob);

    expect(resizeImage).not.toHaveBeenCalled();
    expect(getVideoPoster).not.toHaveBeenCalled();
  });

  it('keeps raster and video preview generation on their dedicated paths', async() => {
    const blob = { type: 'image/png' };
    const file = { type: 'video/mp4' };
    const resizeImage = jest.fn().mockResolvedValue('raster-preview');
    const getVideoPoster = jest.fn().mockResolvedValue('video-preview');

    await expect(createBackgroundPreview({
      blob,
      file,
      validation: { kind: 'image', mime: 'image/png' },
      resizeImage,
      getVideoPoster
    })).resolves.toBe('raster-preview');
    await expect(createBackgroundPreview({
      blob,
      file,
      validation: { kind: 'video', mime: 'video/mp4' },
      resizeImage,
      getVideoPoster
    })).resolves.toBe('video-preview');

    expect(resizeImage).toHaveBeenCalledTimes(1);
    expect(resizeImage).toHaveBeenCalledWith(blob);
    expect(getVideoPoster).toHaveBeenCalledTimes(1);
    expect(getVideoPoster).toHaveBeenCalledWith(file);
  });

  it('does not replace the preview before delayed persistence succeeds', async() => {
    let resolvePersistence;
    const persist = jest.fn(() => new Promise(resolve => {
      resolvePersistence = resolve;
    }));
    const createObjectURL = jest.fn(() => 'blob:new');
    const revokeObjectURL = jest.fn();
    const apply = jest.fn();
    const reportError = jest.fn();

    const pending = commitBackgroundUpload({
      record: { id: 'background', blobThumbnail: 'thumbnail' },
      persist,
      createObjectURL,
      previousObjectURL: 'blob:old',
      revokeObjectURL,
      apply,
      reportError
    });

    await Promise.resolve();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    resolvePersistence('background');
    await expect(pending).resolves.toEqual({
      ok: true,
      objectURL: 'blob:new'
    });
    expect(apply).toHaveBeenCalledWith('blob:new');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:old');
    expect(reportError).not.toHaveBeenCalled();
  });

  it.each([
    ['undefined', () => Promise.resolve(undefined)],
    ['false', () => Promise.resolve(false)],
    ['rejection', () => Promise.reject(new Error('quota'))]
  ])('preserves the previous image after %s persistence result', async(
    label,
    persist
  ) => {
    const createObjectURL = jest.fn(() => 'blob:new');
    const revokeObjectURL = jest.fn();
    const apply = jest.fn();
    const reportError = jest.fn();

    await expect(commitBackgroundUpload({
      record: { id: 'background', blobThumbnail: 'thumbnail' },
      persist,
      createObjectURL,
      previousObjectURL: 'blob:old',
      revokeObjectURL,
      apply,
      reportError
    })).resolves.toMatchObject({ ok: false, reason: 'persist' });

    expect(label).toBeTruthy();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('revokes a new object URL when applying the persisted preview fails', async() => {
    const revokeObjectURL = jest.fn();
    const reportError = jest.fn();

    await expect(commitBackgroundUpload({
      record: { id: 'background', blobThumbnail: 'thumbnail' },
      persist: jest.fn().mockResolvedValue('background'),
      createObjectURL: jest.fn(() => 'blob:new'),
      previousObjectURL: 'blob:old',
      revokeObjectURL,
      reportError,
      apply: jest.fn(() => {
        throw new Error('preview unavailable');
      })
    })).resolves.toMatchObject({ ok: false, reason: 'persist' });

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:new');
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('restores the previous background record and preview when applying the UI fails', async() => {
    const revokeObjectURL = jest.fn();
    const rollback = jest.fn().mockResolvedValue(undefined);

    await expect(commitBackgroundUpload({
      record: { id: 'background', blobThumbnail: 'new-thumbnail' },
      persist: jest.fn().mockResolvedValue('background'),
      createObjectURL: jest.fn(() => 'blob:new'),
      previousObjectURL: 'blob:old',
      revokeObjectURL,
      rollback,
      apply: jest.fn(() => {
        throw new Error('preview unavailable');
      })
    })).resolves.toMatchObject({ ok: false, reason: 'persist' });

    expect(rollback).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:new');
    expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:old');
  });

  it('keeps a committed preview when revoking the previous URL fails', async() => {
    await expect(commitBackgroundUpload({
      record: { id: 'background', blobThumbnail: 'thumbnail' },
      persist: jest.fn().mockResolvedValue('background'),
      createObjectURL: jest.fn(() => 'blob:new'),
      previousObjectURL: 'blob:old',
      revokeObjectURL: jest.fn(() => {
        throw new Error('old URL already released');
      }),
      apply: jest.fn()
    })).resolves.toEqual({ ok: true, objectURL: 'blob:new' });
  });
});
