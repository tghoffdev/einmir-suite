/**
 * Bulk Proof Pack Generator
 *
 * Creates a mega-ZIP containing all individual proof packs organized in folders,
 * plus summary reports and manifest.
 */

import JSZip from "jszip";
import type { BatchItem, BulkManifest, BulkSummary } from "@/types/bulk";

export interface BulkProofPackData {
  items: BatchItem[];
  dsp: string;
  startTime: number;
  endTime: number;
}

export interface BulkProofPackResult {
  blob: Blob;
  filename: string;
  summary: BulkSummary;
}

/**
 * Generate the bulk proof pack mega-ZIP
 */
export async function generateBulkProofPack(
  data: BulkProofPackData
): Promise<BulkProofPackResult> {
  const zip = new JSZip();
  const timestamp = new Date().toISOString();
  const processingTimeMs = data.endTime - data.startTime;

  // Calculate summary stats
  const summary: BulkSummary = {
    total: data.items.length,
    passed: data.items.filter((i) => i.complianceStatus === "pass").length,
    failed: data.items.filter((i) => i.complianceStatus === "fail").length,
    warned: data.items.filter((i) => i.complianceStatus === "warn").length,
    errored: data.items.filter((i) => i.status === "error").length,
    processingTimeMs,
  };

  // Create manifest
  const manifest: BulkManifest = {
    version: "1.0.0",
    generated: timestamp,
    generatedBy: "Doppelist v0.1.0",
    summary,
    items: data.items.map((item, index) => ({
      index: index + 1,
      id: item.id,
      name: item.name,
      folder: item.status === "error"
        ? `failed/${String(index + 1).padStart(3, "0")}-${sanitizeFilename(item.name)}`
        : `ads/${String(index + 1).padStart(3, "0")}-${sanitizeFilename(item.name)}`,
      inputType: item.inputType,
      dimensions: { width: item.width, height: item.height },
      complianceStatus: item.status === "error"
        ? "error" as const
        : (item.complianceStatus === "pending" || !item.complianceStatus)
          ? "warn" as const
          : item.complianceStatus,
      processingTimeMs: item.processingTimeMs || 0,
      error: item.error,
    })),
    settings: {
      recordingDuration: 3000,
      dsp: data.dsp,
      personalization: false,
    },
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Add individual proof packs to folders
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const folderName = item.status === "error"
      ? `failed/${String(i + 1).padStart(3, "0")}-${sanitizeFilename(item.name)}`
      : `ads/${String(i + 1).padStart(3, "0")}-${sanitizeFilename(item.name)}`;

    if (item.status === "error") {
      // For errored items, just add an error.txt
      zip.file(`${folderName}/error.txt`, item.error || "Unknown error");

      // Add original tag if available
      if (item.inputType === "tag") {
        zip.file(`${folderName}/tag-original.html`, item.content);
      }
    } else if (item.proofPack) {
      // Extract the individual proof pack ZIP and add its contents to the folder
      try {
        const proofZip = await JSZip.loadAsync(item.proofPack);
        const files = Object.keys(proofZip.files);

        for (const filename of files) {
          const file = proofZip.files[filename];
          if (!file.dir) {
            const content = await file.async("blob");
            zip.file(`${folderName}/${filename}`, content);
          }
        }
      } catch (error) {
        // If we can't extract the proof pack, store it as-is
        zip.file(`${folderName}/proof-pack.zip`, item.proofPack);
      }
    }
  }

  // Generate summary reports
  zip.file("summary-report.txt", generateTextSummary(manifest, data.items));
  zip.file("summary-report.html", generateHtmlSummary(manifest, data.items));

  // Generate ZIP blob
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // Generate filename
  const dateStr = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `bulk-proof-pack-${dateStr}.zip`;

  return { blob, filename, summary };
}

/**
 * Sanitize a string for use in filenames
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9_-]/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 50);
}

/**
 * Generate plain text summary report
 */
function generateTextSummary(manifest: BulkManifest, items: BatchItem[]): string {
  const lines: string[] = [];

  lines.push("=" .repeat(60));
  lines.push("BULK PROOF PACK SUMMARY");
  lines.push("=" .repeat(60));
  lines.push("");
  lines.push(`Generated: ${manifest.generated}`);
  lines.push(`Total Ads: ${manifest.summary.total}`);
  lines.push(`Processing Time: ${formatDuration(manifest.summary.processingTimeMs)}`);
  lines.push("");

  lines.push("-".repeat(60));
  lines.push("RESULTS");
  lines.push("-".repeat(60));
  lines.push(`  Passed:  ${manifest.summary.passed}`);
  lines.push(`  Failed:  ${manifest.summary.failed}`);
  lines.push(`  Warned:  ${manifest.summary.warned}`);
  lines.push(`  Errors:  ${manifest.summary.errored}`);
  lines.push("");

  lines.push("-".repeat(60));
  lines.push("ITEMS");
  lines.push("-".repeat(60));

  for (const item of manifest.items) {
    const statusIcon = item.complianceStatus === "pass"
      ? "[PASS]"
      : item.complianceStatus === "fail"
      ? "[FAIL]"
      : item.complianceStatus === "warn"
      ? "[WARN]"
      : "[ERR ]";

    lines.push(`${String(item.index).padStart(3, " ")}. ${statusIcon} ${item.name}`);
    lines.push(`       Size: ${item.dimensions.width}x${item.dimensions.height} | Type: ${item.inputType.toUpperCase()}`);

    if (item.error) {
      lines.push(`       Error: ${item.error}`);
    }

    lines.push("");
  }

  lines.push("-".repeat(60));
  lines.push("PACKAGE CONTENTS");
  lines.push("-".repeat(60));
  lines.push("manifest.json - This package metadata");
  lines.push("summary-report.txt - This file");
  lines.push("summary-report.html - Interactive summary");
  lines.push("ads/ - Individual proof packs");
  lines.push("failed/ - Failed items with error info");
  lines.push("");

  lines.push("=" .repeat(60));
  lines.push("Generated by Doppelist - MRAID Ad QA Tool");
  lines.push("=" .repeat(60));

  return lines.join("\n");
}

/**
 * Generate interactive HTML summary report
 */
function generateHtmlSummary(manifest: BulkManifest, items: BatchItem[]): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const passRate = manifest.summary.total > 0
    ? Math.round((manifest.summary.passed / manifest.summary.total) * 100)
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bulk Proof Pack Summary</title>
  <style>
    :root {
      --bg: #1a1a1a;
      --fg: #fafafa;
      --muted: #888;
      --border: #333;
      --card: #242424;
      --cyan: #22d3ee;
      --emerald: #34d399;
      --amber: #fbbf24;
      --red: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: var(--muted); font-size: 0.875rem; margin-bottom: 2rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 1rem;
      text-align: center;
    }
    .stat-value { font-size: 1.75rem; font-weight: 700; }
    .stat-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; }
    .stat.pass .stat-value { color: var(--emerald); }
    .stat.fail .stat-value { color: var(--red); }
    .stat.warn .stat-value { color: var(--amber); }
    .stat.error .stat-value { color: var(--red); }
    .table-container {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: var(--bg); font-size: 0.75rem; text-transform: uppercase; color: var(--muted); }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: var(--bg); }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.pass { background: rgba(52, 211, 153, 0.2); color: var(--emerald); }
    .badge.fail { background: rgba(248, 113, 113, 0.2); color: var(--red); }
    .badge.warn { background: rgba(251, 191, 36, 0.2); color: var(--amber); }
    .badge.error { background: rgba(248, 113, 113, 0.2); color: var(--red); }
    .badge.tag { background: rgba(251, 191, 36, 0.2); color: var(--amber); }
    .badge.html5 { background: rgba(34, 211, 238, 0.2); color: var(--cyan); }
    .size { font-family: monospace; font-size: 0.875rem; color: var(--muted); }
    .error-msg { font-size: 0.75rem; color: var(--red); margin-top: 0.25rem; }
    .folder-link { color: var(--cyan); text-decoration: none; }
    .folder-link:hover { text-decoration: underline; }
    .footer { margin-top: 2rem; text-align: center; color: var(--muted); font-size: 0.75rem; }
    @media (max-width: 640px) {
      .stats { grid-template-columns: repeat(2, 1fr); }
      th, td { padding: 0.5rem; font-size: 0.875rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Bulk Proof Pack Summary</h1>
    <div class="meta">
      Generated: ${escapeHtml(manifest.generated)} |
      Duration: ${formatDuration(manifest.summary.processingTimeMs)} |
      DSP: ${escapeHtml(manifest.settings.dsp)}
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${manifest.summary.total}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat pass">
        <div class="stat-value">${manifest.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat fail">
        <div class="stat-value">${manifest.summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat warn">
        <div class="stat-value">${manifest.summary.warned}</div>
        <div class="stat-label">Warned</div>
      </div>
      <div class="stat error">
        <div class="stat-value">${manifest.summary.errored}</div>
        <div class="stat-label">Errors</div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Size</th>
            <th>Type</th>
            <th>Status</th>
            <th>Folder</th>
          </tr>
        </thead>
        <tbody>
          ${manifest.items.map((item) => `
            <tr>
              <td>${item.index}</td>
              <td>
                ${escapeHtml(item.name)}
                ${item.error ? `<div class="error-msg">${escapeHtml(item.error)}</div>` : ""}
              </td>
              <td><span class="size">${item.dimensions.width}×${item.dimensions.height}</span></td>
              <td><span class="badge ${item.inputType}">${item.inputType === "html5" ? "ZIP" : "TAG"}</span></td>
              <td><span class="badge ${item.complianceStatus}">${item.complianceStatus}</span></td>
              <td><a href="${escapeHtml(item.folder)}/index.html" class="folder-link">${escapeHtml(item.folder)}/</a></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated by Doppelist - MRAID Ad QA Tool<br>
      Pass Rate: ${passRate}%
    </div>
  </div>
</body>
</html>`;
}

/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Download the bulk proof pack
 */
export function downloadBulkProofPack(result: BulkProofPackResult): void {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
