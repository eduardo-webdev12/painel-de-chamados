// Converts the VX logo to base64 for use in jsPDF
export async function getLogoBase64(): Promise<string> {
  const response = await fetch(new URL("@/assets/logo-vx.png", import.meta.url).href);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
