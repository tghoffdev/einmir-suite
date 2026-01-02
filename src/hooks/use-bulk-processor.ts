"use client";

import { useState, useCallback, useRef } from "react";
import type {
  BatchItem,
  BatchState,
  BulkProgress,
  ExtractedZipInfo,
  CompletedItemInfo,
  BatchErrorInfo,
} from "@/types/bulk";

interface UseBulkProcessorOptions {
  /** Callback to load a tag into the preview */
  onLoadTag: (tag: string, width: number, height: number) => void;
  /** Callback to load HTML5 zip into the preview */
  onLoadHtml5: (
    files: Record<string, { content: string; contentType: string }>,
    entryPoint: string,
    width: number,
    height: number
  ) => Promise<void>;
  /** Callback to run compliance check */
  onRunCompliance: () => void;
  /** Callback to get current compliance result */
  getComplianceResult: () => { status: "pass" | "fail" | "warn" | "pending" | null } | null;
  /** Callback to prepare recording (request permission) */
  onPrepareRecording: () => Promise<void>;
  /** Callback to start recording */
  onStartRecording: () => void;
  /** Callback to stop recording and get blob */
  onStopRecording: () => Promise<Blob | null>;
  /** Callback to generate proof pack for current ad */
  onGenerateProofPack: () => Promise<Blob | null>;
  /** Wait for ad to be ready */
  waitForAdReady: () => Promise<void>;
  /** Callback when all items complete */
  onComplete?: (items: BatchItem[]) => void;
}

interface UseBulkProcessorReturn {
  state: BatchState;
  progress: BulkProgress;
  addItems: (items: BatchItem[], extractedZips?: ExtractedZipInfo[]) => void;
  updateItems: (items: BatchItem[]) => void;
  removeItem: (id: string) => void;
  clearQueue: () => void;
  startProcessing: () => Promise<void>;
  cancelProcessing: () => void;
  getExtractedZip: (itemId: string) => ExtractedZipInfo | undefined;
}

const SETTLE_DURATION = 1000; // Wait after ad loads
const COUNTDOWN_DURATION = 2000; // Pre-recording countdown
const RECORDING_DURATION = 3000; // Recording length
const SECONDS_PER_AD = 8;

export function useBulkProcessor(options: UseBulkProcessorOptions): UseBulkProcessorReturn {
  const {
    onLoadTag,
    onLoadHtml5,
    onRunCompliance,
    getComplianceResult,
    onPrepareRecording,
    onStartRecording,
    onStopRecording,
    onGenerateProofPack,
    waitForAdReady,
    onComplete,
  } = options;

  // State
  const [state, setState] = useState<BatchState>({
    items: [],
    isProcessing: false,
    currentIndex: -1,
  });

  const [progress, setProgress] = useState<BulkProgress>({
    phase: "idle",
    currentItem: -1,
    totalItems: 0,
    currentItemName: "",
    currentItemStatus: "",
    startTime: 0,
    estimatedTimeRemaining: 0,
    completedItems: [],
    errors: [],
  });

  // Refs
  const extractedZipsRef = useRef<Map<string, ExtractedZipInfo>>(new Map());
  const cancelledRef = useRef(false);
  const proofPacksRef = useRef<Map<string, Blob>>(new Map());

  // Add items to queue
  const addItems = useCallback((items: BatchItem[], extractedZips?: ExtractedZipInfo[]) => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, ...items],
    }));

    // Store extracted zips
    if (extractedZips) {
      extractedZips.forEach((zip) => {
        extractedZipsRef.current.set(zip.itemId, zip);
      });
    }
  }, []);

  // Update items (for reordering, editing)
  const updateItems = useCallback((items: BatchItem[]) => {
    setState((prev) => ({
      ...prev,
      items,
    }));
  }, []);

  // Remove item from queue
  const removeItem = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== id),
    }));
    extractedZipsRef.current.delete(id);
    proofPacksRef.current.delete(id);
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    setState({
      items: [],
      isProcessing: false,
      currentIndex: -1,
    });
    extractedZipsRef.current.clear();
    proofPacksRef.current.clear();
    setProgress({
      phase: "idle",
      currentItem: -1,
      totalItems: 0,
      currentItemName: "",
      currentItemStatus: "",
      startTime: 0,
      estimatedTimeRemaining: 0,
      completedItems: [],
      errors: [],
    });
  }, []);

  // Get extracted zip by item ID
  const getExtractedZip = useCallback((itemId: string) => {
    return extractedZipsRef.current.get(itemId);
  }, []);

  // Update item status
  const updateItemStatus = useCallback((id: string, status: BatchItem["status"], error?: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, status, error } : item
      ),
    }));
  }, []);

  // Update progress
  const updateProgress = useCallback((updates: Partial<BulkProgress>) => {
    setProgress((prev) => ({
      ...prev,
      ...updates,
      estimatedTimeRemaining: updates.currentItem !== undefined
        ? (prev.totalItems - updates.currentItem - 1) * SECONDS_PER_AD * 1000
        : prev.estimatedTimeRemaining,
    }));
  }, []);

  // Process a single item
  const processItem = useCallback(async (item: BatchItem, index: number): Promise<{
    success: boolean;
    complianceStatus?: "pass" | "fail" | "warn";
    proofPack?: Blob;
    error?: string;
  }> => {
    const startTime = Date.now();

    try {
      // Step 1: Load the ad
      updateItemStatus(item.id, "loading");
      updateProgress({
        currentItemStatus: "Loading ad...",
      });

      if (item.inputType === "tag") {
        onLoadTag(item.content, item.width, item.height);
      } else {
        const extractedZip = extractedZipsRef.current.get(item.content);
        if (!extractedZip) {
          throw new Error("Extracted zip data not found");
        }
        await onLoadHtml5(extractedZip.files, extractedZip.entryPoint, item.width, item.height);
      }

      // Wait for ad to be ready
      await waitForAdReady();

      // Settle time
      await new Promise((resolve) => setTimeout(resolve, SETTLE_DURATION));

      if (cancelledRef.current) {
        return { success: false, error: "Cancelled" };
      }

      // Step 2: Run compliance
      updateItemStatus(item.id, "checking");
      updateProgress({
        currentItemStatus: "Running compliance...",
      });

      onRunCompliance();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get compliance result
      const compResult = getComplianceResult();
      const complianceStatus: "pass" | "fail" | "warn" = compResult?.status === "pass"
        ? "pass"
        : compResult?.status === "fail"
        ? "fail"
        : "warn"; // Default to warn if pending or unknown

      if (cancelledRef.current) {
        return { success: false, error: "Cancelled" };
      }

      // Step 3: Record
      updateItemStatus(item.id, "recording");
      updateProgress({
        currentItemStatus: "Recording...",
      });

      // Countdown (if this is first item, permission already granted)
      for (let i = 2; i >= 1; i--) {
        updateProgress({
          currentItemStatus: `Recording in ${i}...`,
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Start recording
      onStartRecording();
      await new Promise((resolve) => setTimeout(resolve, RECORDING_DURATION));

      // Stop recording
      await onStopRecording();

      if (cancelledRef.current) {
        return { success: false, error: "Cancelled" };
      }

      // Step 4: Generate proof pack
      updateItemStatus(item.id, "processing");
      updateProgress({
        currentItemStatus: "Generating proof pack...",
      });

      const proofPack = await onGenerateProofPack();

      if (proofPack) {
        proofPacksRef.current.set(item.id, proofPack);
      }

      const processingTime = Date.now() - startTime;

      // Mark complete
      updateItemStatus(item.id, "complete");
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === item.id
            ? { ...i, status: "complete" as const, complianceStatus, processingTimeMs: processingTime, proofPack: proofPack || undefined }
            : i
        ),
      }));

      return {
        success: true,
        complianceStatus,
        proofPack: proofPack || undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      updateItemStatus(item.id, "error", message);
      return {
        success: false,
        error: message,
      };
    }
  }, [
    onLoadTag,
    onLoadHtml5,
    waitForAdReady,
    onRunCompliance,
    getComplianceResult,
    onStartRecording,
    onStopRecording,
    onGenerateProofPack,
    updateItemStatus,
    updateProgress,
  ]);

  // Start processing all items
  const startProcessing = useCallback(async () => {
    if (state.items.length === 0 || state.isProcessing) return;

    cancelledRef.current = false;
    proofPacksRef.current.clear();

    const items = [...state.items];
    const startTime = Date.now();

    setState((prev) => ({
      ...prev,
      isProcessing: true,
      currentIndex: 0,
      startTime,
    }));

    setProgress({
      phase: "preparing",
      currentItem: 0,
      totalItems: items.length,
      currentItemName: items[0]?.name || "",
      currentItemStatus: "Preparing...",
      startTime,
      estimatedTimeRemaining: items.length * SECONDS_PER_AD * 1000,
      completedItems: [],
      errors: [],
    });

    // Request screen capture permission once at the start
    try {
      await onPrepareRecording();
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        phase: "error",
        currentItemStatus: "Failed to get screen capture permission",
      }));
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        currentIndex: -1,
      }));
      return;
    }

    setProgress((prev) => ({
      ...prev,
      phase: "processing",
    }));

    const completedItems: CompletedItemInfo[] = [];
    const errors: BatchErrorInfo[] = [];

    // Process each item sequentially
    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) break;

      const item = items[i];

      setState((prev) => ({
        ...prev,
        currentIndex: i,
      }));

      setProgress((prev) => ({
        ...prev,
        currentItem: i,
        currentItemName: item.name,
        currentItemStatus: "Loading...",
        completedItems,
        errors,
      }));

      const result = await processItem(item, i);

      if (result.success) {
        completedItems.push({
          id: item.id,
          name: item.name,
          status: result.complianceStatus || "pass",
          processingTimeMs: Date.now() - startTime,
        });
      } else if (result.error !== "Cancelled") {
        errors.push({
          id: item.id,
          name: item.name,
          message: result.error || "Unknown error",
        });
        // Still add to completed with error status
        completedItems.push({
          id: item.id,
          name: item.name,
          status: "error",
          processingTimeMs: 0,
        });
      }
    }

    // Finalize
    const endTime = Date.now();

    if (cancelledRef.current) {
      setProgress((prev) => ({
        ...prev,
        phase: "cancelled",
        completedItems,
        errors,
      }));
    } else {
      setProgress((prev) => ({
        ...prev,
        phase: "complete",
        currentItem: items.length,
        currentItemStatus: "Complete",
        estimatedTimeRemaining: 0,
        completedItems,
        errors,
      }));
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      currentIndex: -1,
      endTime,
    }));

    // Call completion callback
    if (onComplete && !cancelledRef.current) {
      onComplete(items.map((item) => ({
        ...item,
        proofPack: proofPacksRef.current.get(item.id),
      })));
    }
  }, [state.items, state.isProcessing, onPrepareRecording, processItem, onComplete]);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true;
    setProgress((prev) => ({
      ...prev,
      phase: "cancelled",
    }));
  }, []);

  return {
    state,
    progress,
    addItems,
    updateItems,
    removeItem,
    clearQueue,
    startProcessing,
    cancelProcessing,
    getExtractedZip,
  };
}
