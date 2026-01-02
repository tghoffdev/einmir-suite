/**
 * CSV Parser for Bulk Upload
 *
 * Parses CSV/TSV input with columns: tag, name, size
 * Handles quoted fields containing commas and newlines.
 */

import type { CSVParseResult, ParsedCSVRow } from "@/types/bulk";

/**
 * Parse CSV text into rows
 * Supports: comma, tab, and semicolon delimiters
 * Handles quoted fields with embedded delimiters/newlines
 */
export function parseCSV(text: string): CSVParseResult {
  const errors: string[] = [];
  const rows: ParsedCSVRow[] = [];

  if (!text.trim()) {
    return { rows, errors };
  }

  // Detect delimiter (comma, tab, or semicolon)
  const delimiter = detectDelimiter(text);

  // Parse into raw rows
  const rawRows = parseCSVRows(text, delimiter);

  // Check if first row is a header
  const hasHeader = isHeaderRow(rawRows[0], delimiter);
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lineNum = hasHeader ? i + 2 : i + 1;

    if (!row || row.length === 0 || (row.length === 1 && !row[0].trim())) {
      continue; // Skip empty rows
    }

    const tag = row[0]?.trim();
    if (!tag) {
      errors.push(`Row ${lineNum}: Missing tag content`);
      continue;
    }

    // Validate it looks like a tag
    if (!looksLikeTag(tag)) {
      errors.push(`Row ${lineNum}: Content doesn't appear to be an ad tag`);
      continue;
    }

    const parsed: ParsedCSVRow = {
      tag,
      name: row[1]?.trim() || undefined,
      size: row[2]?.trim() || undefined,
    };

    // Validate size format if provided
    if (parsed.size && !isValidSize(parsed.size)) {
      errors.push(`Row ${lineNum}: Invalid size format "${parsed.size}" (expected WxH)`);
      parsed.size = undefined;
    }

    rows.push(parsed);
  }

  return { rows, errors };
}

/**
 * Detect the delimiter used in CSV text
 */
function detectDelimiter(text: string): string {
  const firstLine = text.split("\n")[0] || "";

  // Count occurrences outside quotes
  const counts = { ",": 0, "\t": 0, ";": 0 };
  let inQuotes = false;

  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char in counts) {
        counts[char as keyof typeof counts]++;
      }
    }
  }

  // Return most common delimiter
  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

/**
 * Parse CSV into array of rows, handling quoted fields
 */
function parseCSVRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else if (char !== "\r") {
        currentField += char;
      }
    }
  }

  // Don't forget the last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Check if the first row looks like a header
 */
function isHeaderRow(row: string[] | undefined, _delimiter: string): boolean {
  if (!row || row.length === 0) return false;

  const firstCell = row[0].toLowerCase().trim();
  const headerKeywords = ["tag", "adtag", "ad_tag", "script", "code", "html"];

  return headerKeywords.some((kw) => firstCell.includes(kw));
}

/**
 * Check if content looks like an ad tag
 */
function looksLikeTag(content: string): boolean {
  const trimmed = content.trim().toLowerCase();

  // Should contain script tag or iframe
  if (trimmed.includes("<script") || trimmed.includes("<iframe")) {
    return true;
  }

  // Or be a URL (for HTML5 bundles referenced by URL)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return true;
  }

  // Or contain common ad macros
  if (trimmed.includes("${") || trimmed.includes("%%") || trimmed.includes("{{")) {
    return true;
  }

  return false;
}

/**
 * Validate size format (WxH)
 */
function isValidSize(size: string): boolean {
  return /^\d+x\d+$/i.test(size.trim());
}

/**
 * Parse size string to width/height
 */
export function parseSize(size: string): { width: number; height: number } | null {
  const match = size.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return null;

  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
}

/**
 * Try to detect ad dimensions from tag content
 */
export function detectSizeFromTag(tag: string): { width: number; height: number } | null {
  // Look for width/height attributes
  const widthMatch = tag.match(/width[=:]["']?(\d+)/i);
  const heightMatch = tag.match(/height[=:]["']?(\d+)/i);

  if (widthMatch && heightMatch) {
    return {
      width: parseInt(widthMatch[1], 10),
      height: parseInt(heightMatch[1], 10),
    };
  }

  // Look for common size patterns in URLs or attributes
  const sizeMatch = tag.match(/(\d{2,4})x(\d{2,4})/);
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1], 10);
    const height = parseInt(sizeMatch[2], 10);
    // Sanity check - reasonable ad sizes
    if (width >= 50 && width <= 2000 && height >= 50 && height <= 2000) {
      return { width, height };
    }
  }

  return null;
}

/**
 * Generate a name from tag content
 */
export function generateNameFromTag(tag: string, index: number): string {
  // Try to extract from src URL
  const srcMatch = tag.match(/src=["']([^"']+)["']/i);
  if (srcMatch) {
    const url = srcMatch[1];
    // Extract filename or last path segment
    const segments = url.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && !lastSegment.includes("?") && lastSegment.length < 50) {
      return lastSegment.replace(/\.[^.]+$/, ""); // Remove extension
    }
  }

  // Try to find campaign/creative ID patterns
  const idMatch = tag.match(/(?:campaign|creative|ad)[_-]?id[=:]?\s*["']?([a-z0-9_-]+)/i);
  if (idMatch) {
    return `Creative_${idMatch[1]}`;
  }

  // Default to generic name with index
  return `Ad_${String(index + 1).padStart(3, "0")}`;
}
