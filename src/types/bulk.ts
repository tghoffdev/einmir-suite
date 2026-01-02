/**
 * Bulk Upload & Batch Proof Collection Types
 */

/** Input type for batch items */
export type BatchInputType = "tag" | "html5";

/** Status of a batch item during processing */
export type BatchItemStatus =
  | "pending" // Waiting to be processed
  | "loading" // Loading content into preview
  | "checking" // Running compliance checks
  | "recording" // Capturing video proof
  | "processing" // Generating proof pack
  | "complete" // Successfully processed
  | "error" // Failed with error
  | "skipped"; // Skipped by user

/** Single item in the batch queue */
export interface BatchItem {
  id: string; // Unique identifier (uuid)
  name: string; // Display name
  inputType: BatchInputType; // Tag or HTML5 zip
  content: string; // Tag HTML or zip file data URL
  width: number; // Ad width
  height: number; // Ad height
  status: BatchItemStatus; // Current processing status
  error?: string; // Error message if failed
  proofPack?: Blob; // Generated proof pack blob
  complianceStatus?: "pass" | "fail" | "warn" | "pending";
  processingTimeMs?: number; // Time to process this item
}

/** Batch processing state */
export interface BatchState {
  items: BatchItem[];
  isProcessing: boolean;
  currentIndex: number; // -1 if not processing
  startTime?: number;
  endTime?: number;
}

/** Options for batch processing */
export interface BatchProcessingOptions {
  recordingDuration?: number; // Default: 3000ms
  settleDuration?: number; // Wait after load: 1000ms
  countdownDuration?: number; // Pre-recording: 2000ms
}

/** Progress information during batch processing */
export interface BulkProgress {
  phase: "idle" | "preparing" | "processing" | "finalizing" | "complete" | "error" | "cancelled";
  currentItem: number; // 0-indexed, -1 if not started
  totalItems: number;
  currentItemName: string;
  currentItemStatus: string; // "Loading...", "Recording...", etc.
  startTime: number;
  estimatedTimeRemaining: number; // ms
  completedItems: CompletedItemInfo[];
  errors: BatchErrorInfo[];
}

export interface CompletedItemInfo {
  id: string;
  name: string;
  status: "pass" | "fail" | "warn" | "error";
  processingTimeMs: number;
}

export interface BatchErrorInfo {
  id: string;
  name: string;
  message: string;
}

/** Parsed CSV row */
export interface ParsedCSVRow {
  tag: string;
  name?: string;
  size?: string; // "300x250" format
}

/** Result from CSV parsing */
export interface CSVParseResult {
  rows: ParsedCSVRow[];
  errors: string[];
}

/** Result from tag splitting */
export interface TagSplitResult {
  tags: string[];
  delimiter: string; // Detected delimiter
}

/** Cached extraction for HTML5 zips */
export interface ExtractedZipInfo {
  itemId: string;
  files: Record<string, { content: string; contentType: string }>;
  entryPoint: string;
  originalName: string;
}

/** Manifest for mega-ZIP */
export interface BulkManifest {
  version: string;
  generated: string; // ISO timestamp
  generatedBy: string;
  summary: BulkSummary;
  items: BulkManifestItem[];
  settings: BulkSettings;
}

export interface BulkSummary {
  total: number;
  passed: number;
  failed: number;
  warned: number;
  errored: number;
  processingTimeMs: number;
}

export interface BulkManifestItem {
  index: number;
  id: string;
  name: string;
  folder: string;
  inputType: BatchInputType;
  dimensions: { width: number; height: number };
  complianceStatus: "pass" | "fail" | "warn" | "error";
  processingTimeMs: number;
  error?: string;
}

export interface BulkSettings {
  recordingDuration: number;
  dsp: string;
  personalization: boolean;
}
