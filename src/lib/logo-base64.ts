// Loads logo as base64 for use in jsPDF
// Uses the ICON VERDE as primary logo
async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getLogoBase64(): Promise<string> {
  // Try the green icon first, fall back to original logo
  try {
    return await fetchAsBase64(new URL("@/assets/icon-verde-vx.png", import.meta.url).href);
  } catch {
    return await fetchAsBase64(new URL("@/assets/logo-vx.png", import.meta.url).href);
  }
}

// Pre-load and cache the logo
let cachedLogo: string | null = null;
export async function getCachedLogoBase64(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    cachedLogo = await getLogoBase64();
    return cachedLogo;
  } catch {
    console.warn("Failed to load VX logo for PDF");
    return null;
  }
}
