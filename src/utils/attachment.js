/**
 * Utility to resolve absolute attachment URLs, prepending the backend API base URL
 * if the attachment url is relative (e.g. starting with /uploads/).
 */
export const getAttachmentUrl = (url, filename) => {
  if (!url) return "";

  // Handle object passed instead of URL string
  if (typeof url === "object" && url !== null) {
    const objUrl = url.url || url.publicUrl || url.downloadUrl || "";
    const objName = filename || url.name || url.fileName || url.filename || "";
    return getAttachmentUrl(objUrl, objName);
  }

  let resolvedUrl = String(url);

  // Translate legacy GCP storage URLs to local VM upload paths if present in imported records
  if (resolvedUrl.startsWith("https://storage.googleapis.com/")) {
    const match = resolvedUrl.match(/https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)/);
    if (match && match[1]) {
      resolvedUrl = "/uploads/" + match[1];
    }
  }
  if (resolvedUrl.startsWith("users/")) {
    resolvedUrl = "/uploads/" + resolvedUrl;
  } else if (resolvedUrl.startsWith("/users/")) {
    resolvedUrl = "/uploads" + resolvedUrl;
  }

  if (
    resolvedUrl.startsWith("blob:") ||
    resolvedUrl.startsWith("data:")
  ) {
    return resolvedUrl;
  }

  // If already an external http/https URL and not our local backend /uploads
  if (
    (resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://")) &&
    !resolvedUrl.includes("/uploads/")
  ) {
    return resolvedUrl;
  }

  // Resolve API Base URL consistently with src/api/client.js
  const runtime = globalThis.__APP_CONFIG__?.VITE_API_BASE_URL;
  let apiBaseUrl = "";
  if (runtime && !runtime.startsWith("/AAA")) {
    apiBaseUrl = runtime;
  } else {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl && !envUrl.startsWith("/AAA")) {
      apiBaseUrl = envUrl;
    } else {
      apiBaseUrl = import.meta.env.DEV ? "" : "http://localhost:9000";
    }
  }

  const cleanBase = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  const cleanPath = resolvedUrl.startsWith("/") ? resolvedUrl : "/" + resolvedUrl;

  // Route through the backend /api/attachments/download endpoint with inline=true
  // This guarantees:
  // 1. Works with API Gateway (/api/attachments/**) in dev (Vite proxy) and prod
  // 2. Returns Content-Type: application/pdf (or image/...) and Content-Disposition: inline
  // 3. Allows PDF/images to be previewed directly in new browser tabs
  const encodedPath = encodeURIComponent(cleanPath);
  const nameParam = filename ? `&filename=${encodeURIComponent(filename)}` : "";
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  return `${cleanBase}/api/attachments/download?url=${encodedPath}${nameParam}${tokenParam}&inline=true`;
};
