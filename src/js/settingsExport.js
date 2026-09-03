export const SETTINGS_EXPORT_FILE_NAME = 'startgrid-settings.backup';

const SETTINGS_EXPORT_PICKER_OPTIONS = Object.freeze({
  suggestedName: SETTINGS_EXPORT_FILE_NAME,
  types: [{
    description: 'JSON settings backup',
    accept: { 'application/json': ['.json', '.backup'] }
  }]
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
  const blob = new BlobConstructor([JSON.stringify(data)], { type: 'application/json' });

  if (typeof picker !== 'function') {
    try {
      downloadWithAnchor(blob, fallbackDependencies);
      return { ok: true, method: 'download' };
    } catch (error) {
      return { ok: false, error };
    }
  }

  try {
    const fileHandle = await picker(SETTINGS_EXPORT_PICKER_OPTIONS);
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, method: 'picker' };
  } catch (error) {
    if (isPickerCancellation(error)) return { ok: false, cancelled: true };
    return { ok: false, error };
  }
}
