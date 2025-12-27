"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TagInput, type InputMode } from "@/components/tag-input";
import { SizeSelector } from "@/components/size-selector";
import { PreviewFrame } from "@/components/preview-frame";
import { BackgroundColorPicker } from "@/components/background-color-picker";
import { CaptureControls } from "@/components/capture-controls";
import {
  useRecorder,
  downloadVideo,
  type RecordingMode,
  type CropConfig,
} from "@/hooks/use-recorder";
import { captureScreenshot, downloadScreenshot } from "@/lib/capture/screenshot";
import { createZipArchive, downloadBlob, type ZipFile } from "@/lib/capture/zip";
import { useProcessing } from "@/hooks/use-processing";
import type { AdSize, OutputFormat } from "@/types";
import {
  registerServiceWorker,
  loadHtml5Ad,
  getPreviewUrl,
  clearHtml5Ad,
  updateConfig,
} from "@/lib/html5/sw-manager";
import type { ZipLoadResult } from "@/lib/html5/zip-loader";

export default function Home() {
  const [tagValue, setTagValue] = useState("");
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(250);

  // The tag that's currently loaded in the preview
  const [loadedTag, setLoadedTag] = useState<string | null>(null);
  const [isAdReady, setIsAdReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // HTML5 zip upload state
  const [inputMode, setInputMode] = useState<InputMode>("tag");
  const [html5Url, setHtml5Url] = useState<string | null>(null);
  const [html5EntryPoint, setHtml5EntryPoint] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);
  const [isLoadingHtml5, setIsLoadingHtml5] = useState(false);

  // Preview settings
  const [backgroundColor, setBackgroundColor] = useState("#0f0f23");
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("clip");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("webm");

  // Processing hook for MP4 conversion
  const processing = useProcessing();

  // Track when we're in the process of starting a capture (before recording actually begins)
  const [isStartingCapture, setIsStartingCapture] = useState(false);

  // Countdown for reload-and-record
  const [countdown, setCountdown] = useState<number | null>(null);

  // Ref for the preview frame (used for clip recording mode)
  const previewFrameRef = useRef<HTMLDivElement>(null);

  // Batch capture sizes
  const [batchSizes, setBatchSizes] = useState<AdSize[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentSize: string;
  } | null>(null);

  // Key to force reload the preview
  const [previewKey, setPreviewKey] = useState(0);

  // Ref to the preview container for screenshots
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Ref to resolve a promise when ad becomes ready (for reload-and-record)
  const adReadyResolverRef = useRef<(() => void) | null>(null);

  // Refs to track current dimensions and format for recording (avoids stale closures)
  const dimensionsRef = useRef({ width, height });
  dimensionsRef.current = { width, height };
  const outputFormatRef = useRef(outputFormat);
  outputFormatRef.current = outputFormat;

  // Recording hook - use ref for dimensions to avoid stale closure
  const recorder = useRecorder({
    onRecordingComplete: async (blob) => {
      const { width: w, height: h } = dimensionsRef.current;
      const format = outputFormatRef.current;
      const timestamp = Date.now();

      if (format === "mp4") {
        // Convert to MP4
        const mp4Blob = await processing.processVideo(blob, "mp4");
        downloadVideo(mp4Blob, `recording-${w}x${h}-${timestamp}.mp4`);
      } else {
        // Download as WebM directly
        downloadVideo(blob, `recording-${w}x${h}-${timestamp}.webm`);
      }
    },
  });

  // Register service worker on mount for HTML5 zip support
  useEffect(() => {
    registerServiceWorker().then((ready) => {
      setSwReady(ready);
      if (!ready) {
        console.warn("Service worker not available - HTML5 zip upload disabled");
      }
    });
  }, []);

  // Update service worker config when dimensions change (for HTML5 content)
  useEffect(() => {
    if (html5Url) {
      updateConfig({ width, height });
    }
  }, [width, height, html5Url]);

  // Handle HTML5 zip upload
  const handleHtml5Load = useCallback(
    async (result: ZipLoadResult) => {
      if (!swReady) {
        console.error("Service worker not ready");
        return;
      }

      setIsLoadingHtml5(true);
      try {
        // Clear any existing tag content
        setLoadedTag(null);
        setIsAdReady(false);

        // Load files into service worker
        await loadHtml5Ad(result.files, { width, height });

        // Set the preview URL
        const url = getPreviewUrl(result.entryPoint);
        setHtml5EntryPoint(result.entryPoint);
        setHtml5Url(url);
        setPreviewKey((k) => k + 1);
      } catch (error) {
        console.error("Failed to load HTML5 ad:", error);
      } finally {
        setIsLoadingHtml5(false);
      }
    },
    [swReady, width, height]
  );

  const handleLoadTag = useCallback(() => {
    if (tagValue.trim()) {
      // Clear HTML5 content when loading a tag
      if (html5Url) {
        clearHtml5Ad();
        setHtml5Url(null);
        setHtml5EntryPoint(null);
      }
      setLoadedTag(tagValue.trim());
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);
    }
  }, [tagValue, html5Url]);

  const handleReload = useCallback(() => {
    if (loadedTag || html5Url) {
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);
    }
  }, [loadedTag, html5Url]);

  const handleClear = useCallback(() => {
    setLoadedTag(null);
    setIsAdReady(false);
    setTagValue("");
    // Also clear HTML5 content
    if (html5Url) {
      clearHtml5Ad();
      setHtml5Url(null);
      setHtml5EntryPoint(null);
    }
  }, [html5Url]);

  const handleAdReady = useCallback(() => {
    setIsAdReady(true);
    // If we're waiting for ad ready (reload-and-record), resolve the promise
    if (adReadyResolverRef.current) {
      adReadyResolverRef.current();
      adReadyResolverRef.current = null;
    }
  }, []);

  const handleResize = useCallback((newWidth: number, newHeight: number) => {
    setWidth(newWidth);
    setHeight(newHeight);
  }, []);

  const handleScreenshot = useCallback(async () => {
    if (!previewFrameRef.current) return;

    // Use ref to ensure we always have the latest dimensions
    const { width: currentWidth, height: currentHeight } = dimensionsRef.current;

    // Set starting capture before the dialog appears
    setIsStartingCapture(true);
    try {
      const result = await captureScreenshot({
        element: previewFrameRef.current,
        width: currentWidth,
        height: currentHeight,
      });
      downloadScreenshot(result.blob, `screenshot-${currentWidth}x${currentHeight}-${Date.now()}.png`);
    } catch (error) {
      console.error("Screenshot failed:", error);
    } finally {
      setIsStartingCapture(false);
    }
  }, []);

  const handleBatchScreenshot = useCallback(async () => {
    if (!previewContainerRef.current || batchSizes.length === 0) return;

    const originalWidth = width;
    const originalHeight = height;
    const timestamp = Date.now();
    const files: ZipFile[] = [];

    setIsCapturing(true);

    try {
      for (let i = 0; i < batchSizes.length; i++) {
        const size = batchSizes[i];
        setBatchProgress({
          current: i + 1,
          total: batchSizes.length,
          currentSize: size.label,
        });

        // Resize to target size
        setWidth(size.width);
        setHeight(size.height);

        // Wait for resize and render
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Capture screenshot
        const result = await captureScreenshot({
          element: previewContainerRef.current!,
          width: size.width,
          height: size.height,
        });

        files.push({
          filename: `screenshot-${size.width}x${size.height}.png`,
          blob: result.blob,
        });

        // Small delay between captures
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Create and download zip
      setBatchProgress({
        current: batchSizes.length,
        total: batchSizes.length,
        currentSize: "Creating zip...",
      });

      const zipBlob = await createZipArchive(files);
      downloadBlob(zipBlob, `screenshots-${timestamp}.zip`);
    } catch (error) {
      console.error("Batch screenshot failed:", error);
    } finally {
      // Restore original size
      setWidth(originalWidth);
      setHeight(originalHeight);
      setBatchProgress(null);
      setIsCapturing(false);
    }
  }, [batchSizes, width, height]);

  const handleStartRecording = useCallback(async () => {
    setIsStartingCapture(true);
    try {
      let cropConfig: CropConfig | null = null;

      if (recordingMode === "clip" && previewFrameRef.current) {
        // Use getter functions for dynamic dimensions
        cropConfig = {
          element: () => previewFrameRef.current,
          width: () => dimensionsRef.current.width,
          height: () => dimensionsRef.current.height,
        };
      }

      await recorder.startRecording(cropConfig);
    } catch (error) {
      console.error("Failed to start recording:", error);
    } finally {
      setIsStartingCapture(false);
    }
  }, [recorder, recordingMode]);

  const handleStopRecording = useCallback(async () => {
    try {
      await recorder.stopRecording();
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  }, [recorder]);

  const handleReloadAndRecord = useCallback(async () => {
    if (!loadedTag && !html5Url) return;

    setIsStartingCapture(true);
    try {
      // Step 1: Request screen capture permission first (shows dialog)
      // This prepares the stream but doesn't start recording yet
      let cropConfig: CropConfig | null = null;

      if (recordingMode === "clip") {
        // Use getter functions so they always get the current element/dimensions
        // (the element changes when the preview reloads, dimensions change on resize)
        cropConfig = {
          element: () => previewFrameRef.current,
          width: () => dimensionsRef.current.width,
          height: () => dimensionsRef.current.height,
        };
      }

      // This will show the screen share dialog but NOT start recording
      await recorder.prepareRecording(cropConfig);

      // Step 2: Show countdown (3, 2, 1)
      for (let i = 3; i >= 1; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);

      // Step 3: Wait for countdown overlay to clear from the DOM
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 4: Reload the ad unit and wait for it to be ready
      const adReadyPromise = new Promise<void>((resolve) => {
        adReadyResolverRef.current = resolve;
      });
      setIsAdReady(false);
      setPreviewKey((k) => k + 1);

      // Step 5: Wait for ad to signal ready
      await adReadyPromise;

      // Step 6: Delay after ready to let ad fully render (skip loading animations)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 7: Start the recording now
      recorder.beginPreparedRecording();
    } catch (error) {
      console.error("Failed to start reload-and-record:", error);
      setCountdown(null);
    } finally {
      setIsStartingCapture(false);
    }
  }, [loadedTag, html5Url, recorder, recordingMode]);

  return (
    <div className="h-screen bg-background overflow-hidden">
      <main className="container mx-auto px-4 py-4 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 h-full">
          {/* Left Column - Controls */}
          <div className="space-y-4 overflow-y-auto">
            {/* Title */}
            <h1 className="text-lg font-semibold">MRAID Capture Tool</h1>

            {/* Tag Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ad Content</CardTitle>
              </CardHeader>
              <CardContent>
                <TagInput
                  value={tagValue}
                  onChange={setTagValue}
                  onLoad={handleLoadTag}
                  onHtml5Load={handleHtml5Load}
                  inputMode={inputMode}
                  onInputModeChange={setInputMode}
                  disabled={false}
                />
              </CardContent>
            </Card>

            {/* Size Controls */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Size</CardTitle>
              </CardHeader>
              <CardContent>
                <SizeSelector
                  width={width}
                  height={height}
                  onWidthChange={setWidth}
                  onHeightChange={setHeight}
                  batchSizes={batchSizes}
                  onBatchSizesChange={setBatchSizes}
                />
              </CardContent>
            </Card>

            {/* Preview Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Background</CardTitle>
              </CardHeader>
              <CardContent>
                <BackgroundColorPicker
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview */}
          <Card className="flex flex-col h-full overflow-hidden">
            {/* Actions Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReload}
                  variant="outline"
                  size="sm"
                  disabled={!loadedTag && !html5Url}
                >
                  Reload
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  size="sm"
                  disabled={!loadedTag && !html5Url}
                >
                  Clear
                </Button>
                {isAdReady && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Ready
                  </span>
                )}
              </div>
              <CaptureControls
                recordingState={recorder.state}
                hasContent={(!!loadedTag || !!html5Url) && isAdReady}
                onScreenshot={handleScreenshot}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                onReloadAndRecord={handleReloadAndRecord}
                isCapturing={isCapturing}
                batchSizesCount={batchSizes.length}
                onBatchScreenshot={handleBatchScreenshot}
                batchProgress={batchProgress}
                recordingMode={recordingMode}
                onRecordingModeChange={setRecordingMode}
                isRegionCaptureSupported={recorder.isRegionCaptureSupported}
                isCountingDown={countdown !== null}
                outputFormat={outputFormat}
                onOutputFormatChange={setOutputFormat}
                conversionProgress={
                  processing.isProcessing
                    ? { progress: processing.progress, status: processing.status }
                    : null
                }
              />
            </div>
            {/* Preview Area */}
            <CardContent className="flex-1 p-4 overflow-hidden">
              <div ref={previewContainerRef} className="h-full">
                <PreviewFrame
                  ref={previewFrameRef}
                  key={previewKey}
                  width={width}
                  height={height}
                  tag={loadedTag}
                  html5Url={html5Url}
                  isLoadingHtml5={isLoadingHtml5}
                  backgroundColor={backgroundColor}
                  onReady={handleAdReady}
                  onResize={handleResize}
                  suppressOverflowWarning={isStartingCapture || recorder.state.isRecording || recorder.state.isProcessing || isCapturing}
                  countdown={countdown}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
