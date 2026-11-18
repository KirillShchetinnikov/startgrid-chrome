export const SETTINGS_EXPORT_FILE_NAME = 'startgrid-settings.json';

export const SETTINGS_JSON_FILE_TYPES = Object.freeze([{
  description: 'JSON settings',
  accept: { 'application/json': ['.json'] }
}]);

const SETTINGS_EXPORT_PICKER_OPTIONS = Object.freeze({
  suggestedName: SETTINGS_EXPORT_FILE_NAME,
  types: SETTINGS_JSON_FILE_TYPES
});

function isPickerCancellation(error) {
  return error?.name === 'AbortError';
}

function downloadWithAnchor(blob, {
  createObjectURL = URL.createObjectURL,
  revokeObjectURL = URL.revokeObjectURL,
  document = window.document,
  setTimeout = window.setTimeout
} = {}) {
  const url = createObjectURL(blob);
  let link;

  try {
    link = document.createElement('a');
    link.href = url;
    link.download = SETTINGS_EXPORT_FILE_NAME;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link?.remove();
    setTimeout(() => revokeObjectURL(url), 0);
  }
}

export async function exportSettings(data, dependencies = {}) {
  const {
    showSaveFilePicker,
    Blob: BlobConstructor = Blob,
    ...fallbackDependencies
  } = dependencies;
  const picker = Object.prototype.hasOwnProperty.call(dependencies, 'showSaveFilePicker')
    ? showSaveFilePicker
    : window.showSaveFilePicker;
  try {
    // Open the native picker while the click still carries user activation.
    const fileHandle = typeof picker === 'function' ? await picker(SETTINGS_EXPORT_PICKER_OPTIONS) : null;
    const values = typeof data === 'function' ? await data() : data;
    const blob = new BlobConstructor([JSON.stringify(values)], { type: 'application/json' });
    if (!fileHandle) {
      downloadWithAnchor(blob, fallbackDependencies);
      return { ok: true, method: 'download' };
    }
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, method: 'picker' };
  } catch (error) {
    if (isPickerCancellation(error)) return { ok: false, cancelled: true };
    return { ok: false, error };
  }
}
