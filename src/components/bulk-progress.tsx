"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { BulkProgress, BatchItem } from "@/types/bulk";

interface BulkProgressProps {
  progress: BulkProgress;
  items: BatchItem[];
  onCancel: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting...",
  loading: "Loading ad...",
  checking: "Running compliance...",
  recording: "Recording...",
  processing: "Generating proof...",
  complete: "Complete",
  error: "Error",
  skipped: "Skipped",
};

export function BulkProgressModal({ progress, items, onCancel }: BulkProgressProps) {
  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (progress.totalItems === 0) return 0;
    return Math.round((progress.currentItem / progress.totalItems) * 100);
  }, [progress.currentItem, progress.totalItems]);

  // Format time remaining
  const timeRemaining = useMemo(() => {
    const seconds = Math.ceil(progress.estimatedTimeRemaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }, [progress.estimatedTimeRemaining]);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "bg-emerald-500/20 text-emerald-400";
      case "fail":
        return "bg-red-500/20 text-red-400";
      case "warn":
        return "bg-amber-500/20 text-amber-400";
      case "error":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const isComplete = progress.phase === "complete" || progress.phase === "cancelled";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border border-border rounded-lg shadow-lg p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {progress.phase === "preparing"
              ? "Preparing..."
              : progress.phase === "finalizing"
              ? "Generating Proof Pack..."
              : progress.phase === "complete"
              ? "Complete!"
              : progress.phase === "cancelled"
              ? "Cancelled"
              : progress.phase === "error"
              ? "Error"
              : "Bulk Proof Collection"}
          </h2>
          {!isComplete && (
            <span className="text-sm text-muted-foreground">
              {timeRemaining} remaining
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {progress.currentItem + 1} of {progress.totalItems}
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Current item */}
        {progress.phase === "processing" && progress.currentItemName && (
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{progress.currentItemName}</div>
              <div className="text-sm text-muted-foreground">
                {progress.currentItemStatus}
              </div>
            </div>
          </div>
        )}

        {/* Item list */}
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {items.map((item, index) => {
            const isActive = index === progress.currentItem && progress.phase === "processing";
            const isCompleted = progress.completedItems.some((c) => c.id === item.id);
            const completedInfo = progress.completedItems.find((c) => c.id === item.id);
            const hasError = progress.errors.some((e) => e.id === item.id);
            const errorInfo = progress.errors.find((e) => e.id === item.id);

            return (
              <div
                key={item.id}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded text-sm
                  ${isActive ? "bg-primary/10 border border-primary/30" : "bg-muted/20"}
                `}
              >
                {/* Status indicator */}
                <div className="w-5 flex justify-center">
                  {isActive ? (
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : isCompleted ? (
                    <span
                      className={`
                        w-4 h-4 flex items-center justify-center rounded-full text-[10px]
                        ${completedInfo?.status === "pass" ? "bg-emerald-500 text-white" : ""}
                        ${completedInfo?.status === "fail" ? "bg-red-500 text-white" : ""}
                        ${completedInfo?.status === "warn" ? "bg-amber-500 text-white" : ""}
                        ${completedInfo?.status === "error" ? "bg-red-500 text-white" : ""}
                      `}
                    >
                      {completedInfo?.status === "pass" ? "✓" : completedInfo?.status === "error" ? "!" : "–"}
                    </span>
                  ) : hasError ? (
                    <span className="w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px]">
                      !
                    </span>
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                  )}
                </div>

                {/* Name */}
                <span className="flex-1 truncate">{item.name}</span>

                {/* Size */}
                <span className="text-xs text-muted-foreground">
                  {item.width}×{item.height}
                </span>

                {/* Status badge */}
                {(isCompleted || hasError) && (
                  <span
                    className={`
                      px-1.5 py-0.5 rounded text-[10px] font-medium uppercase
                      ${getStatusColor(completedInfo?.status || "error")}
                    `}
                  >
                    {completedInfo?.status || "error"}
                  </span>
                )}

                {/* Active status */}
                {isActive && (
                  <span className="text-xs text-primary">
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Errors */}
        {progress.errors.length > 0 && (
          <div className="p-3 bg-destructive/10 rounded-lg space-y-1">
            <div className="text-sm font-medium text-destructive">
              {progress.errors.length} error{progress.errors.length > 1 ? "s" : ""}
            </div>
            {progress.errors.slice(0, 3).map((err) => (
              <div key={err.id} className="text-xs text-destructive/80">
                {err.name}: {err.message}
              </div>
            ))}
            {progress.errors.length > 3 && (
              <div className="text-xs text-destructive/60">
                ...and {progress.errors.length - 3} more
              </div>
            )}
          </div>
        )}

        {/* Summary (when complete) */}
        {isComplete && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-muted/30 rounded">
              <div className="text-lg font-bold">{progress.totalItems}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded">
              <div className="text-lg font-bold text-emerald-400">
                {progress.completedItems.filter((c) => c.status === "pass").length}
              </div>
              <div className="text-xs text-muted-foreground">Passed</div>
            </div>
            <div className="p-2 bg-amber-500/10 rounded">
              <div className="text-lg font-bold text-amber-400">
                {progress.completedItems.filter((c) => c.status === "warn" || c.status === "fail").length}
              </div>
              <div className="text-xs text-muted-foreground">Issues</div>
            </div>
            <div className="p-2 bg-red-500/10 rounded">
              <div className="text-lg font-bold text-red-400">
                {progress.errors.length}
              </div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          {!isComplete ? (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <Button onClick={onCancel}>Close</Button>
          )}
        </div>
      </div>
    </div>
  );
}
