// Render one frame, including animated PNG/WebP/GIF/SVG, without persisting over
// the original full-mode background. The returned image cannot keep animating.
export async function createStaticBackground(blob, {
  maxWidth = Infinity, maxHeight = Infinity, type = 'image/png'
} = {}) {
  if (!blob || blob.type.startsWith('video/')) return null;
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const width = image.naturalWidth || 300;
    const height = image.naturalHeight || 150;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(result => result
        ? resolve(result) : reject(new Error('Background conversion failed')), type, 0.9);
    });
  } finally {
    image.removeAttribute('src');
    URL.revokeObjectURL(url);
  }
}
