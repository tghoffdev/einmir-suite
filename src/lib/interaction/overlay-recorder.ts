/**
 * Overlay Event Recorder
 *
 * Uses a transparent overlay to capture mouse position and show visual feedback.
 * The overlay intercepts mousedown to record the click and show a ripple,
 * then immediately disables itself so the click passes through to the iframe.
 */

import type {
  InteractionEvent,
  InteractionEventType,
  TouchPoint,
} from "@/types/interaction";

export interface OverlayRecorderOptions {
  /** The container element that holds the iframe */
  container: HTMLElement;
  /** Width of the ad */
  width: number;
  /** Height of the ad */
  height: number;
  /** Callback when event count changes */
  onEventCountChange?: (count: number) => void;
}

export class OverlayRecorder {
  private events: InteractionEvent[] = [];
  private startTime: number = 0;
  private isRecording: boolean = false;
  private overlay: HTMLDivElement | null = null;
  private cursor: HTMLDivElement | null = null;
  private container: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private width: number = 0;
  private height: number = 0;
  private onEventCountChange?: (count: number) => void;
  private reEnableTimeout: ReturnType<typeof setTimeout> | null = null;

  // Bound handlers for cleanup
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseLeave: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;

  constructor() {
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseLeave = this.onMouseLeave.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
  }

  /**
   * Start recording events
   */
  start(options: OverlayRecorderOptions): boolean {
    if (this.isRecording) {
      console.warn("[OverlayRecorder] Already recording");
      return false;
    }

    const { container, width, height, onEventCountChange } = options;

    // Find the iframe within the container
    const iframe = container.querySelector("iframe");
    if (!iframe) {
      console.warn("[OverlayRecorder] No iframe found in container");
      return false;
    }

    this.container = container;
    this.iframe = iframe;
    this.width = width;
    this.height = height;
    this.onEventCountChange = onEventCountChange;
    this.events = [];
    this.startTime = performance.now();

    // Create the overlay
    this.createOverlay();

    this.isRecording = true;
    console.log("[OverlayRecorder] Started recording with mousedown capture");
    return true;
  }

  /**
   * Stop recording and remove overlay
   */
  stop(): InteractionEvent[] {
    if (!this.isRecording) {
      return this.events;
    }

    this.isRecording = false;

    if (this.reEnableTimeout) {
      clearTimeout(this.reEnableTimeout);
      this.reEnableTimeout = null;
    }

    this.removeOverlay();

    console.log(`[OverlayRecorder] Stopped. Captured ${this.events.length} events`);
    return [...this.events];
  }

  getEventCount(): number {
    return this.events.length;
  }

  getDuration(): number {
    if (!this.isRecording) {
      return this.events.length > 0
        ? this.events[this.events.length - 1].timestamp
        : 0;
    }
    return performance.now() - this.startTime;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  clear(): void {
    this.events = [];
  }

  private createOverlay(): void {
    if (!this.container || !this.iframe) return;

    // Create overlay - starts with pointer-events: auto to capture mousedown
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      cursor: none;
      background: transparent;
      border: 3px solid #ef4444;
      box-sizing: border-box;
    `;

    // Recording indicator
    const indicator = document.createElement("div");
    indicator.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(239, 68, 68, 0.95);
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    `;
    indicator.innerHTML = `
      <span style="width: 8px; height: 8px; background: white; border-radius: 50%; animation: pulse 1s infinite;"></span>
      REC
    `;
    this.overlay.appendChild(indicator);

    // Create cursor element - visible circle that follows the mouse
    this.cursor = document.createElement("div");
    this.cursor.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      pointer-events: none;
      transform: translate(-50%, -50%);
      opacity: 0;
      transition: opacity 0.1s ease;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.5), inset 0 0 4px rgba(255, 255, 255, 0.3);
      z-index: 1001;
    `;
    this.overlay.appendChild(this.cursor);

    // Add animations
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes clickRipple {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
    `;
    this.overlay.appendChild(style);

    // Position the container
    const containerStyle = getComputedStyle(this.container);
    if (containerStyle.position === "static") {
      this.container.style.position = "relative";
    }

    // Append to ad container for correct positioning
    const adContainer = this.iframe.parentElement;
    if (adContainer) {
      adContainer.style.position = "relative";
      adContainer.appendChild(this.overlay);
    } else {
      this.container.appendChild(this.overlay);
    }

    // Attach event listeners
    this.overlay.addEventListener("mousedown", this.boundMouseDown);
    this.overlay.addEventListener("mousemove", this.boundMouseMove);
    this.overlay.addEventListener("mouseleave", this.boundMouseLeave);
    this.overlay.addEventListener("touchstart", this.boundTouchStart, { passive: false });
  }

  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.removeEventListener("mousedown", this.boundMouseDown);
      this.overlay.removeEventListener("mousemove", this.boundMouseMove);
      this.overlay.removeEventListener("mouseleave", this.boundMouseLeave);
      this.overlay.removeEventListener("touchstart", this.boundTouchStart);
      this.overlay.remove();
      this.overlay = null;
    }
    this.cursor = null;
    this.container = null;
    this.iframe = null;
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.isRecording || !this.overlay) return;

    const rect = this.overlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Record the click
    const timestamp = performance.now() - this.startTime;
    this.recordEvent("click", x, y, timestamp, event.button);
    console.log(`[OverlayRecorder] Captured click at (${Math.round(x)}, ${Math.round(y)})`);

    // Show ripple effect immediately (will be visible in video)
    this.showClickRipple(x, y);

    // Immediately disable pointer-events so mouseup/click pass through to iframe
    this.overlay.style.pointerEvents = "none";

    // Re-enable after the click sequence completes
    if (this.reEnableTimeout) {
      clearTimeout(this.reEnableTimeout);
    }
    this.reEnableTimeout = setTimeout(() => {
      if (this.overlay && this.isRecording) {
        this.overlay.style.pointerEvents = "auto";
      }
    }, 150);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.cursor || !this.overlay) return;

    const rect = this.overlay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Update cursor position
    this.cursor.style.left = `${x}px`;
    this.cursor.style.top = `${y}px`;
    this.cursor.style.opacity = "1";
  }

  private onMouseLeave(): void {
    if (this.cursor) {
      this.cursor.style.opacity = "0";
    }
  }

  private onTouchStart(event: TouchEvent): void {
    if (!this.isRecording || !this.overlay) return;

    const rect = this.overlay.getBoundingClientRect();
    const touch = event.touches[0];
    if (!touch) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Only record if within bounds
    if (x < 0 || y < 0 || x > this.width || y > this.height) {
      return;
    }

    const timestamp = performance.now() - this.startTime;
    const touches: TouchPoint[] = Array.from(event.touches).map((t) => ({
      x: Math.round(t.clientX - rect.left),
      y: Math.round(t.clientY - rect.top),
      identifier: t.identifier,
    }));

    this.recordTouchEvent("touchstart", x, y, timestamp, touches);
    console.log(`[OverlayRecorder] Captured touch at (${Math.round(x)}, ${Math.round(y)})`);

    // Show ripple
    this.showClickRipple(x, y);

    // Disable pointer events so touch continues to iframe
    this.overlay.style.pointerEvents = "none";

    // Re-enable after touch
    if (this.reEnableTimeout) {
      clearTimeout(this.reEnableTimeout);
    }
    this.reEnableTimeout = setTimeout(() => {
      if (this.overlay && this.isRecording) {
        this.overlay.style.pointerEvents = "auto";
      }
    }, 300);
  }

  private showClickRipple(x: number, y: number): void {
    if (!this.overlay) return;

    const ripple = document.createElement("div");
    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.5);
      border: 3px solid rgba(255, 255, 255, 0.95);
      border-radius: 50%;
      pointer-events: none;
      animation: clickRipple 0.4s ease-out forwards;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.4);
      z-index: 1002;
    `;
    this.overlay.appendChild(ripple);

    // Remove after animation
    setTimeout(() => ripple.remove(), 400);
  }

  private recordEvent(
    type: InteractionEventType,
    x: number,
    y: number,
    timestamp: number,
    button?: number
  ): void {
    const event: InteractionEvent = {
      type,
      timestamp: Math.round(timestamp),
      x: Math.round(x),
      y: Math.round(y),
      button,
    };
    this.events.push(event);
    this.onEventCountChange?.(this.events.length);
  }

  private recordTouchEvent(
    type: InteractionEventType,
    x: number,
    y: number,
    timestamp: number,
    touches?: TouchPoint[]
  ): void {
    const event: InteractionEvent = {
      type,
      timestamp: Math.round(timestamp),
      x: Math.round(x),
      y: Math.round(y),
      touches,
    };
    this.events.push(event);
    this.onEventCountChange?.(this.events.length);
  }
}

// Singleton
let overlayRecorderInstance: OverlayRecorder | null = null;

export function getOverlayRecorder(): OverlayRecorder {
  if (!overlayRecorderInstance) {
    overlayRecorderInstance = new OverlayRecorder();
  }
  return overlayRecorderInstance;
}
