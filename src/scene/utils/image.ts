// A foto vai para o localStorage como data URL junto da cena. Foto de celular em
// base64 estoura sozinha a cota (~5 MB), então reduz antes de guardar.
const MAX_IMAGE_SIDE = 512;

/** Lê um arquivo de imagem e devolve data URL JPEG reduzida a `MAX_IMAGE_SIDE`. */
export async function readImageDownscaled(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
