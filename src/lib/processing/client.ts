import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type { OutputFormat } from "@/types";

/**
 * Client-side Video Processing
 *
 * Uses FFmpeg WASM for browser-based video processing.
 * Note: This is slow (~30-60s for typical recordings) but works entirely client-side.
 */

export interface ProcessingOptions {
  outputFormat: OutputFormat;
  onProgress?: (progress: number, status: string) => void;
}

// Singleton FFmpeg instance
let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Fetches a URL and converts it to a blob URL
 */
async function toBlobURL(url: string, mimeType: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return URL.createObjectURL(new Blob([await blob.arrayBuffer()], { type: mimeType }));
}

/**
 * Lazily loads FFmpeg WASM
 */
async function getFFmpeg(
  onProgress?: (progress: number, status: string) => void
): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }

  if (loadPromise) {
    await loadPromise;
    return ffmpeg!;
  }

  ffmpeg = new FFmpeg();

  // Set up logging
  ffmpeg.on("log", ({ message }) => {
    console.log("[FFmpeg]", message);
  });

  // Set up progress tracking
  ffmpeg.on("progress", ({ progress }) => {
    // FFmpeg can return weird values, clamp to 0-100
    const percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
    onProgress?.(percent, `Converting... ${percent}%`);
  });

  loadPromise = (async () => {
    onProgress?.(0, "Loading FFmpeg...");

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

    await ffmpeg!.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    onProgress?.(0, "FFmpeg loaded");
  })();

  await loadPromise;
  return ffmpeg;
}

/**
 * Converts a WebM blob to MP4 using FFmpeg WASM
 */
export async function convertToMp4(
  inputBlob: Blob,
  onProgress?: (progress: number, status: string) => void
): Promise<Blob> {
  const ff = await getFFmpeg(onProgress);

  onProgress?.(0, "Preparing video...");

  // Write input file
  const inputData = await fetchFile(inputBlob);
  await ff.writeFile("input.webm", inputData);

  onProgress?.(5, "Converting to MP4...");

  // Convert WebM to MP4 using H.264 codec
  // -vf scale - Ensure dimensions are divisible by 2 (required by H.264)
  // -c:v libx264 - H.264 video codec (broad compatibility)
  // -preset fast - Balance between speed and compression
  // -crf 23 - Quality level (lower = better, 23 is default)
  // -c:a aac - AAC audio codec
  // -movflags +faststart - Enable streaming/progressive download
  await ff.exec([
    "-i",
    "input.webm",
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    "output.mp4",
  ]);

  onProgress?.(95, "Finalizing...");

  // Read output file
  const outputData = await ff.readFile("output.mp4");

  // Clean up
  await ff.deleteFile("input.webm");
  await ff.deleteFile("output.mp4");

  onProgress?.(100, "Done!");

  // Convert to blob - copy to a new ArrayBuffer to avoid SharedArrayBuffer issues
  if (outputData instanceof Uint8Array) {
    const buffer = new ArrayBuffer(outputData.byteLength);
    const view = new Uint8Array(buffer);
    view.set(outputData);
    return new Blob([buffer], { type: "video/mp4" });
  }

  // Fallback for string data (shouldn't happen for video)
  return new Blob([outputData as string], { type: "video/mp4" });
}

/**
 * Processes a video blob - converts to specified format
 */
export async function processVideo(
  inputBlob: Blob,
  options: ProcessingOptions
): Promise<Blob> {
  const { outputFormat, onProgress } = options;

  // If already WebM or no conversion needed, return as-is
  if (outputFormat === "webm") {
    return inputBlob;
  }

  // Convert to MP4
  return convertToMp4(inputBlob, onProgress);
}
