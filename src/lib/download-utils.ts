/**
 * Utility functions for handling presigned URL downloads
 * Replaces the old streaming download pattern
 */

/**
 * Download file using presigned URL (browser-direct download)
 * @param fileKey - R2 file key (e.g., "audio/song.mp3")
 * @param filename - Desired filename for download
 * @returns Promise that resolves when download starts
 */
export async function downloadFileViaPresignedUrl(
  fileKey: string,
  filename?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Get presigned URL from API (minimal bandwidth)
    const response = await fetch(
      `/api/download?url=${encodeURIComponent(fileKey)}&filename=${encodeURIComponent(filename || 'download')}`
    );

    if (!response.ok) {
      return { success: false, error: `API error: ${response.statusText}` };
    }

    const data = await response.json();

    if (!data.success || !data.url) {
      return { success: false, error: data.error || "Failed to get download URL" };
    }

    // Step 2: Download directly from presigned URL (bandwidth NOT counted in Vercel)
    const link = document.createElement("a");
    link.href = data.url;
    link.download = filename || "download";
    link.click();

    return { success: true };
  } catch (error: any) {
    console.error("Download error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get presigned URL without downloading (useful for sharing)
 * @param fileKey - R2 file key
 * @returns Presigned URL string
 */
export async function getPresignedDownloadUrl(
  fileKey: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch(
      `/api/download?url=${encodeURIComponent(fileKey)}`
    );

    if (!response.ok) {
      return { success: false, error: `API error: ${response.statusText}` };
    }

    const data = await response.json();

    if (!data.success || !data.url) {
      return { success: false, error: data.error };
    }

    return { success: true, url: data.url };
  } catch (error: any) {
    console.error("Get URL error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Open file in new tab using presigned URL
 * @param fileKey - R2 file key
 * @returns Promise
 */
export async function openFileInNewTab(fileKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { success, url, error } = await getPresignedDownloadUrl(fileKey);

    if (!success || !url) {
      return { success: false, error };
    }

    window.open(url, "_blank", "noopener,noreferrer");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
