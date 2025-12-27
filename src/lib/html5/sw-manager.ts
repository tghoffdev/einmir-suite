/**
 * Service Worker Manager
 *
 * Manages the HTML5 preview service worker lifecycle and communication.
 */

import type { ExtractedFiles } from "./zip-loader";

let swRegistration: ServiceWorkerRegistration | null = null;
let isReady = false;
let readyPromise: Promise<void> | null = null;
let readyResolve: (() => void) | null = null;

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return "serviceWorker" in navigator;
}

/**
 * Register the HTML5 preview service worker
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    console.warn("[SW Manager] Service workers not supported");
    return false;
  }

  try {
    // Listen for messages from service worker FIRST (before registration)
    navigator.serviceWorker.addEventListener("message", handleSWMessage);

    swRegistration = await navigator.serviceWorker.register("/html5-sw.js", {
      scope: "/",
      updateViaCache: "none", // Always check for updates
    });

    // Force update check
    await swRegistration.update();

    console.log("[SW Manager] Service worker registered");

    // Wait for the service worker to be active AND controlling this page
    if (navigator.serviceWorker.controller) {
      isReady = true;
      console.log("[SW Manager] Already controlled by SW");
    } else {
      // Wait for the SW to claim this client
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          console.log("[SW Manager] Controller changed - now controlled");
          isReady = true;
          resolve();
        }, { once: true });

        // Also wait for activation in case controller change doesn't fire
        const sw = swRegistration!.installing || swRegistration!.waiting || swRegistration!.active;
        if (sw && sw.state !== "activated") {
          sw.addEventListener("statechange", () => {
            if (sw.state === "activated") {
              // Give it a moment to claim clients
              setTimeout(() => {
                if (!isReady) {
                  console.log("[SW Manager] Activated, assuming ready");
                  isReady = true;
                  resolve();
                }
              }, 100);
            }
          });
        } else if (sw?.state === "activated") {
          // Already activated, just wait a moment for claim
          setTimeout(() => {
            console.log("[SW Manager] Already activated, assuming ready");
            isReady = true;
            resolve();
          }, 100);
        }
      });
    }

    return true;
  } catch (error) {
    console.error("[SW Manager] Registration failed:", error);
    return false;
  }
}

/**
 * Handle messages from the service worker
 */
function handleSWMessage(event: MessageEvent) {
  const { type } = event.data;
  console.log("[SW Manager] Received message:", type);

  if (type === "HTML5_READY") {
    console.log("[SW Manager] HTML5 files loaded in SW");
    if (readyResolve) {
      readyResolve();
      readyResolve = null;
    }
  }
}

/**
 * Load HTML5 ad files into the service worker
 */
export async function loadHtml5Ad(
  files: ExtractedFiles,
  config: { width: number; height: number }
): Promise<void> {
  // Log what we have available
  console.log("[SW Manager] controller:", navigator.serviceWorker.controller);
  console.log("[SW Manager] registration.active:", swRegistration?.active);
  console.log("[SW Manager] registration.waiting:", swRegistration?.waiting);
  console.log("[SW Manager] registration.installing:", swRegistration?.installing);

  // Prefer controller, fallback to registration.active
  const sw = navigator.serviceWorker.controller || swRegistration?.active;

  if (!sw) {
    throw new Error("Service worker not ready - no controller or active SW");
  }

  console.log("[SW Manager] Loading files into SW via:", sw === navigator.serviceWorker.controller ? "controller" : "registration.active");
  console.log("[SW Manager] File count:", Object.keys(files).length);
  console.log("[SW Manager] Files:", Object.keys(files));

  // Create a promise that resolves when SW confirms load
  readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  // Send files to service worker
  sw.postMessage({
    type: "LOAD_HTML5",
    files,
    config,
  });

  console.log("[SW Manager] Message posted to SW");

  // Wait for confirmation (with timeout)
  const timeout = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("SW load timeout")), 5000);
  });

  await Promise.race([readyPromise, timeout]);
  console.log("[SW Manager] Files loaded successfully");
}

/**
 * Update MRAID config (dimensions) in the service worker
 */
export function updateConfig(config: { width: number; height: number }): void {
  if (!swRegistration?.active) {
    return;
  }

  swRegistration.active.postMessage({
    type: "UPDATE_CONFIG",
    config,
  });
}

/**
 * Clear loaded HTML5 files from the service worker
 */
export function clearHtml5Ad(): void {
  if (!swRegistration?.active) {
    return;
  }

  swRegistration.active.postMessage({
    type: "CLEAR_HTML5",
  });
}

/**
 * Get the preview URL for the HTML5 ad
 */
export function getPreviewUrl(entryPoint: string = "index.html"): string {
  // Handle nested entry points
  const path = entryPoint.startsWith("/") ? entryPoint : "/" + entryPoint;
  return `/html5-preview${path}`;
}

/**
 * Check if service worker is ready
 */
export function isSWReady(): boolean {
  return isReady && swRegistration?.active !== null;
}
