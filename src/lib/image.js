/** Zmniejsza zdjęcie do kwadratu 320x320 JPEG (oszczędza miejsce w darmowym planie). */
export function resizeImage(file, size = 320) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Nie udało się przetworzyć zdjęcia'))), 'image/jpeg', 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Nieobsługiwany plik graficzny'));
    img.src = URL.createObjectURL(file);
  });
}
