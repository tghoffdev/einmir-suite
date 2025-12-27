"use client";

import { Button } from "@/components/ui/button";
import type { RecordingState, OutputFormat } from "@/types";

type RecordingMode = "fullscreen" | "clip";

interface BatchProgress {
  current: number;
  total: number;
  currentSize: string;
}

interface CaptureControlsProps {
  recordingState: RecordingState;
  hasContent: boolean;
  onScreenshot: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onReloadAndRecord?: () => void;
  isCapturing?: boolean;
  batchSizesCount?: number;
  onBatchScreenshot?: () => void;
  batchProgress?: BatchProgress | null;
  recordingMode?: RecordingMode;
  onRecordingModeChange?: (mode: RecordingMode) => void;
  isRegionCaptureSupported?: boolean;
  isCountingDown?: boolean;
  outputFormat?: OutputFormat;
  onOutputFormatChange?: (format: OutputFormat) => void;
  conversionProgress?: { progress: number; status: string } | null;
}

export function CaptureControls({
  recordingState,
  hasContent,
  onScreenshot,
  onStartRecording,
  onStopRecording,
  onReloadAndRecord,
  isCapturing = false,
  batchSizesCount = 0,
  onBatchScreenshot,
  batchProgress,
  recordingMode = "clip",
  onRecordingModeChange,
  isRegionCaptureSupported = false,
  isCountingDown = false,
  outputFormat = "webm",
  onOutputFormatChange,
  conversionProgress,
}: CaptureControlsProps) {
  const { isRecording, isProcessing, processingStatus } = recordingState;

  // Show conversion progress
  if (conversionProgress) {
    return (
      <div className="flex items-center gap-2">
        <Button disabled variant="secondary" size="sm">
          {conversionProgress.status}
        </Button>
        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${conversionProgress.progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {conversionProgress.progress}%
        </span>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex items-center gap-2">
        <Button disabled variant="secondary" size="sm">
          {processingStatus || "Processing..."}
        </Button>
      </div>
    );
  }

  if (isCountingDown) {
    return (
      <div className="flex items-center gap-2">
        <Button disabled variant="secondary" size="sm">
          Starting...
        </Button>
        <span className="flex items-center gap-2 text-xs text-orange-500">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          Get ready
        </span>
      </div>
    );
  }

  if (batchProgress) {
    return (
      <div className="flex items-center gap-2">
        <Button disabled variant="secondary" size="sm">
          {batchProgress.current}/{batchProgress.total}: {batchProgress.currentSize}
        </Button>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          Batch capture...
        </span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <Button onClick={onStopRecording} variant="destructive" size="sm">
          Stop Recording
        </Button>
        <span className="flex items-center gap-2 text-xs text-destructive">
          <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          Recording
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onScreenshot}
        variant="outline"
        size="sm"
        disabled={!hasContent || isCapturing}
      >
        {isCapturing ? "Capturing..." : "Screenshot"}
      </Button>
      {/* Batch button - hidden for now */}
      {false && batchSizesCount > 0 && onBatchScreenshot && (
        <Button
          onClick={onBatchScreenshot}
          variant="outline"
          size="sm"
          disabled={!hasContent || isCapturing}
        >
          Batch ({batchSizesCount})
        </Button>
      )}

      {/* Recording mode toggle */}
      {onRecordingModeChange && (
        <div className="flex border border-border rounded-md overflow-hidden">
          <button
            onClick={() => onRecordingModeChange("clip")}
            disabled={!isRegionCaptureSupported}
            className={`px-2 py-1 text-xs transition-colors ${
              recordingMode === "clip"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            } ${!isRegionCaptureSupported ? "opacity-50 cursor-not-allowed" : ""}`}
            title={
              isRegionCaptureSupported
                ? "Record just the ad"
                : "Clip mode not supported in this browser"
            }
          >
            Clip
          </button>
          <button
            onClick={() => onRecordingModeChange("fullscreen")}
            className={`px-2 py-1 text-xs transition-colors border-l border-border ${
              recordingMode === "fullscreen"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
            title="Record the full browser tab"
          >
            Full
          </button>
        </div>
      )}

      {/* Output format toggle */}
      {onOutputFormatChange && (
        <div className="flex border border-border rounded-md overflow-hidden">
          <button
            onClick={() => onOutputFormatChange("webm")}
            className={`px-2 py-1 text-xs transition-colors ${
              outputFormat === "webm"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
            title="WebM format (faster, smaller)"
          >
            WebM
          </button>
          <button
            onClick={() => onOutputFormatChange("mp4")}
            className={`px-2 py-1 text-xs transition-colors border-l border-border ${
              outputFormat === "mp4"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
            title="MP4 format (slower conversion, wider compatibility)"
          >
            MP4
          </button>
        </div>
      )}

      <Button
        onClick={onStartRecording}
        variant="default"
        size="sm"
        disabled={!hasContent}
      >
        Record
      </Button>
      {onReloadAndRecord && (
        <Button
          onClick={onReloadAndRecord}
          variant="secondary"
          size="sm"
          disabled={!hasContent}
          title="Reload the ad and record from the beginning"
        >
          Reload & Record
        </Button>
      )}
    </div>
  );
}
