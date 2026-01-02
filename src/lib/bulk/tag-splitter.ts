/**
 * Tag Splitter for Multi-Tag Paste
 *
 * Splits pasted text containing multiple ad tags into individual tags.
 * Supports various delimiters and auto-detection.
 */

import type { TagSplitResult } from "@/types/bulk";

/** Supported delimiter patterns */
const DELIMITER_PATTERNS = [
  { pattern: /\n===+\n/g, name: "===" },
  { pattern: /\n---+\n/g, name: "---" },
  { pattern: /\n###\n/g, name: "###" },
  { pattern: /\n\n\n+/g, name: "blank lines" },
] as const;

/**
 * Split text containing multiple tags into individual tags
 */
export function splitTags(text: string): TagSplitResult {
  if (!text.trim()) {
    return { tags: [], delimiter: "none" };
  }

  // Try each delimiter pattern
  for (const { pattern, name } of DELIMITER_PATTERNS) {
    if (pattern.test(text)) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      const parts = text.split(pattern).map((p) => p.trim()).filter(Boolean);

      // Validate each part looks like a tag
      const validTags = parts.filter(looksLikeAdTag);

      if (validTags.length >= 2) {
        return { tags: validTags, delimiter: name };
      }
    }
  }

  // Try script tag boundaries
  const scriptTags = extractScriptTags(text);
  if (scriptTags.length >= 2) {
    return { tags: scriptTags, delimiter: "script tags" };
  }

  // No delimiter found - treat as single tag
  const trimmed = text.trim();
  if (looksLikeAdTag(trimmed)) {
    return { tags: [trimmed], delimiter: "single" };
  }

  return { tags: [], delimiter: "none" };
}

/**
 * Check if content looks like an ad tag
 */
function looksLikeAdTag(content: string): boolean {
  const trimmed = content.trim();

  // Must have some content
  if (trimmed.length < 20) return false;

  // Should contain script or iframe tags
  const hasScript = /<script[^>]*>/i.test(trimmed);
  const hasIframe = /<iframe[^>]*>/i.test(trimmed);

  return hasScript || hasIframe;
}

/**
 * Extract individual script tags when pasted together
 */
function extractScriptTags(text: string): string[] {
  const tags: string[] = [];

  // Pattern to match complete script blocks
  // This handles both inline and external scripts
  const scriptPattern = /<script[^>]*>[\s\S]*?<\/script>/gi;

  let match;
  while ((match = scriptPattern.exec(text)) !== null) {
    const scriptTag = match[0].trim();
    // Only include if it looks like an ad (has src with ad-related URL)
    if (isAdScript(scriptTag)) {
      tags.push(scriptTag);
    }
  }

  return tags;
}

/**
 * Check if a script tag is likely an ad tag
 */
function isAdScript(script: string): boolean {
  // Has external src (most ad tags are external)
  if (/src=["'][^"']+["']/i.test(script)) {
    return true;
  }

  // Or contains ad-related keywords
  const adKeywords = [
    "doubleclick",
    "googlesyndication",
    "googleadservices",
    "adsystem",
    "adnxs",
    "criteo",
    "amazon-adsystem",
    "celtra",
    "sizmek",
    "flashtalking",
    "innovid",
    "adroll",
    "taboola",
    "outbrain",
    "campaign",
    "creative",
    "impression",
    "clickTag",
    "CLICK_URL",
  ];

  const lower = script.toLowerCase();
  return adKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Preview how text would be split (for UI feedback)
 */
export function previewSplit(text: string): {
  count: number;
  delimiter: string;
  preview: string[];
} {
  const result = splitTags(text);

  return {
    count: result.tags.length,
    delimiter: result.delimiter,
    preview: result.tags.map((tag) => {
      // Return first 50 chars for preview
      const firstLine = tag.split("\n")[0].trim();
      return firstLine.length > 50 ? firstLine.slice(0, 50) + "..." : firstLine;
    }),
  };
}

/**
 * Join tags with a delimiter (for preview/export)
 */
export function joinTags(tags: string[], delimiter: string = "==="): string {
  const sep = `\n${delimiter}\n`;
  return tags.join(sep);
}

/**
 * Extract a readable identifier from a tag for naming
 */
export function extractTagIdentifier(tag: string, index: number): string {
  // Try to find creative/campaign ID
  const idPatterns = [
    /creative[_-]?id[=:]?\s*["']?([a-z0-9_-]+)/i,
    /campaign[_-]?id[=:]?\s*["']?([a-z0-9_-]+)/i,
    /ad[_-]?id[=:]?\s*["']?([a-z0-9_-]+)/i,
    /placement[_-]?id[=:]?\s*["']?([a-z0-9_-]+)/i,
  ];

  for (const pattern of idPatterns) {
    const match = tag.match(pattern);
    if (match) {
      return match[1].slice(0, 30); // Limit length
    }
  }

  // Try to extract from URL path
  const srcMatch = tag.match(/src=["']([^"']+)["']/i);
  if (srcMatch) {
    const url = srcMatch[1];
    const pathMatch = url.match(/\/([a-z0-9_-]+)\/?(?:\?|$)/i);
    if (pathMatch) {
      return pathMatch[1].slice(0, 30);
    }
  }

  // Try to find size pattern
  const sizeMatch = tag.match(/(\d{2,4})x(\d{2,4})/);
  if (sizeMatch) {
    return `Ad_${sizeMatch[1]}x${sizeMatch[2]}`;
  }

  // Default
  return `Tag_${String(index + 1).padStart(3, "0")}`;
}
