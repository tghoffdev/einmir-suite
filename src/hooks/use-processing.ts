"use client";

import { useState, useCallback } from "react";
import { processVideo as processVideoClient } from "@/lib/processing/client";
import type { OutputFormat } from "@/types";

/**
 * useProcessing Hook
 *
 * Manages video processing state for client-side FFmpeg conversion.
 */

export interface UseProcessingReturn {
  isProcessing: boolean;
  progress: number;
  status: string;
  processVideo: (blob: Blob, format: OutputFormat) => Promise<Blob>;
}

export function useProcessing(): UseProcessingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const processVideo = useCallback(
    async (blob: Blob, format: OutputFormat): Promise<Blob> => {
      // If WebM, no processing needed
      if (format === "webm") {
        return blob;
      }

      setIsProcessing(true);
      setProgress(0);
      setStatus("Starting conversion...");

      try {
        const result = await processVideoClient(blob, {
          outputFormat: format,
          onProgress: (prog, stat) => {
            setProgress(prog);
            setStatus(stat);
          },
        });

        return result;
      } finally {
        setIsProcessing(false);
        setProgress(0);
        setStatus("");
      }
    },
    []
  );

  return {
    isProcessing,
    progress,
    status,
    processVideo,
  };
}
