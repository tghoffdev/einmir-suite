/**
 * HTML5 Zip Loader
 *
 * Extracts HTML5 ad creative zip files and prepares them for the service worker.
 */

import JSZip from "jszip";

export interface ExtractedFile {
  content: string;
  contentType: string;
}

export interface ExtractedFiles {
  [path: string]: ExtractedFile;
}

export interface ZipLoadResult {
  files: ExtractedFiles;
  entryPoint: string;
  fileCount: number;
}

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  eot: "application/vnd.ms-fontobject",
  xml: "application/xml",
  txt: "text/plain",
};

/**
 * Get MIME type from filename
 */
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Check if a content type is text-based
 */
function isTextContent(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType === "application/javascript" ||
    contentType === "application/json" ||
    contentType === "application/xml" ||
    contentType === "image/svg+xml"
  );
}

/**
 * Find the entry point HTML file
 */
function findEntryPoint(files: ExtractedFiles): string {
  const paths = Object.keys(files);

  // Priority order for entry points
  const priorities = ["index.html", "ad.html", "main.html", "default.html"];

  // Check root level first
  for (const name of priorities) {
    if (paths.includes(name)) {
      return name;
    }
  }

  // Check one level deep (common in exported zips)
  for (const name of priorities) {
    const match = paths.find(
      (p) => p.endsWith("/" + name) && p.split("/").length === 2
    );
    if (match) {
      return match;
    }
  }

  // Find any HTML file
  const htmlFile = paths.find((p) => p.endsWith(".html") || p.endsWith(".htm"));
  if (htmlFile) {
    return htmlFile;
  }

  throw new Error("No HTML file found in zip");
}

/**
 * Normalize file paths (remove leading directory if all files share one)
 */
function normalizePaths(files: ExtractedFiles): ExtractedFiles {
  const paths = Object.keys(files);

  // Check if all paths start with the same directory
  const firstSlash = paths[0]?.indexOf("/");
  if (firstSlash === -1) {
    return files; // No common directory
  }

  const commonPrefix = paths[0]?.slice(0, firstSlash + 1);
  const allSharePrefix = paths.every((p) => p.startsWith(commonPrefix || ""));

  if (!allSharePrefix || !commonPrefix) {
    return files;
  }

  // Remove common prefix
  const normalized: ExtractedFiles = {};
  for (const [path, data] of Object.entries(files)) {
    const newPath = path.slice(commonPrefix.length);
    if (newPath) {
      normalized[newPath] = data;
    }
  }

  return normalized;
}

/**
 * Extract a zip file and prepare it for the service worker
 */
export async function extractZip(file: File): Promise<ZipLoadResult> {
  const zip = await JSZip.loadAsync(file);
  const files: ExtractedFiles = {};

  const entries = Object.entries(zip.files);

  for (const [path, zipEntry] of entries) {
    // Skip directories
    if (zipEntry.dir) {
      continue;
    }

    // Skip hidden files and macOS metadata
    if (
      path.startsWith("__MACOSX") ||
      path.includes("/.") ||
      path.startsWith(".")
    ) {
      continue;
    }

    const contentType = getContentType(path);

    if (isTextContent(contentType)) {
      // Text content - get as string
      const content = await zipEntry.async("string");
      files[path] = { content, contentType };
    } else {
      // Binary content - get as base64 data URL
      const base64 = await zipEntry.async("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;
      files[path] = { content: dataUrl, contentType };
    }
  }

  // Normalize paths (remove common root directory)
  const normalizedFiles = normalizePaths(files);

  // Find entry point
  const entryPoint = findEntryPoint(normalizedFiles);

  return {
    files: normalizedFiles,
    entryPoint,
    fileCount: Object.keys(normalizedFiles).length,
  };
}

/**
 * Validate that a file is a valid zip
 */
export async function validateZipFile(file: File): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.keys(zip.files);

    // Must have at least one file
    if (entries.length === 0) {
      return false;
    }

    // Must have an HTML file
    const hasHtml = entries.some(
      (e) =>
        (e.endsWith(".html") || e.endsWith(".htm")) && !zip.files[e].dir
    );

    return hasHtml;
  } catch {
    return false;
  }
}
