/**
 * Analytics Helper
 *
 * Provides typed event tracking via GTM dataLayer.
 */

// Extend window to include dataLayer
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Track an event to GTM dataLayer */
export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({ event, ...data });
  }
}

// ============================================================
// Typed Event Helpers
// ============================================================

/** Content Loading Events */
export const analytics = {
  // Tag/Content
  tagPaste: (vendor: string, tagLength: number) =>
    trackEvent("tag_paste", { vendor, tag_length: tagLength }),

  tagLoad: (vendor: string, width: number, height: number) =>
    trackEvent("tag_load", { vendor, width, height }),

  html5Upload: (fileSize: number, fileCount: number) =>
    trackEvent("html5_upload", { file_size: fileSize, file_count: fileCount }),

  html5Load: (width: number, height: number) =>
    trackEvent("html5_load", { width, height }),

  // Size & Display
  sizeChange: (width: number, height: number, source: "preset" | "manual") =>
    trackEvent("size_change", { width, height, source }),

  sizePresetClick: (sizeLabel: string) =>
    trackEvent("size_preset_click", { size_label: sizeLabel }),

  backgroundChange: (color: string) =>
    trackEvent("background_change", { color }),

  // Capture Actions
  screenshotTaken: (width: number, height: number, vendor: string) =>
    trackEvent("screenshot_taken", { width, height, vendor }),

  recordingStart: (mode: string, width: number, height: number) =>
    trackEvent("recording_start", { mode, width, height }),

  recordingStop: (durationMs: number, format: string) =>
    trackEvent("recording_stop", { duration_ms: durationMs, format }),

  exportDownload: (type: "png" | "webm" | "mp4" | "zip", sizeBytes?: number) =>
    trackEvent("export_download", { type, size_bytes: sizeBytes }),

  // Audit Panel
  auditPanelOpen: (tab: string) =>
    trackEvent("audit_panel_open", { tab }),

  auditPanelClose: () =>
    trackEvent("audit_panel_close"),

  macroDetected: (count: number, formats: string[]) =>
    trackEvent("macro_detected", { count, formats }),

  macroEdit: (macroName: string) =>
    trackEvent("macro_edit", { macro_name: macroName }),

  macroReload: (macroCount: number) =>
    trackEvent("macro_reload", { macro_count: macroCount }),

  textEdit: (elementType: string) =>
    trackEvent("text_edit", { element_type: elementType }),

  textReload: (elementCount: number) =>
    trackEvent("text_reload", { element_count: elementCount }),

  // MRAID Events
  mraidEvent: (type: string, hasUrl: boolean) =>
    trackEvent("mraid_event", { type, has_url: hasUrl }),

  // Errors
  error: (type: string, message: string) =>
    trackEvent("error", { type, message }),
};
