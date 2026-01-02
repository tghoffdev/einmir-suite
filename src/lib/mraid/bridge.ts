/**
 * MRAID Bridge
 *
 * Generates the mraid.js bridge script to inject into iframes.
 * Implements minimal MRAID 3.0 spec methods with mock responses.
 */

export interface MRAIDBridgeOptions {
  width: number;
  height: number;
  placementType?: "inline" | "interstitial";
}

/**
 * Generates MRAID bridge script content
 * This script is injected into the iframe before the ad tag
 */
export function generateMRAIDBridge(options: MRAIDBridgeOptions): string {
  const { width, height, placementType = "inline" } = options;

  return `
(function() {
  // Simulate mobile/app environment for proper ad rendering
  // Some ad SDKs detect touch support to decide video vs image
  if (!('ontouchstart' in window)) {
    window.ontouchstart = null;
  }

  // Ensure touch events are supported
  if (typeof window.TouchEvent === 'undefined') {
    window.TouchEvent = function TouchEvent() {};
  }

  // MRAID Environment object (MRAID 3.0)
  window.MRAID_ENV = {
    version: '3.0',
    sdk: 'MRAID Capture Tool',
    sdkVersion: '1.0.0',
    appId: 'mraid-capture-tool',
    ifa: '',
    limitAdTracking: true,
    coppa: false
  };

  // Event listeners storage
  var listeners = {};
  // Start in loading state - transition to default after DOM ready
  var state = 'loading';
  var viewable = false;

  // MRAID object
  window.mraid = {
    _initialized: true,

    // Version
    getVersion: function() { return '3.0'; },

    // State management
    getState: function() { return state; },

    // Placement
    getPlacementType: function() { return '${placementType}'; },

    // Viewability
    isViewable: function() { return viewable; },

    // Dimensions
    getScreenSize: function() {
      return { width: ${width}, height: ${height} };
    },
    getCurrentPosition: function() {
      return { x: 0, y: 0, width: ${width}, height: ${height} };
    },
    getMaxSize: function() {
      return { width: ${width}, height: ${height} };
    },
    getDefaultPosition: function() {
      return { x: 0, y: 0, width: ${width}, height: ${height} };
    },

    // Expand properties (for expandable ads)
    getExpandProperties: function() {
      return {
        width: ${width},
        height: ${height},
        useCustomClose: false,
        isModal: true
      };
    },
    setExpandProperties: function(props) {
      // No-op in mock
    },

    // Resize properties
    getResizeProperties: function() {
      return {
        width: ${width},
        height: ${height},
        offsetX: 0,
        offsetY: 0,
        customClosePosition: 'top-right',
        allowOffscreen: false
      };
    },
    setResizeProperties: function(props) {
      // No-op in mock
    },

    // Orientation properties
    getOrientationProperties: function() {
      return {
        allowOrientationChange: true,
        forceOrientation: 'none'
      };
    },
    setOrientationProperties: function(props) {
      // No-op in mock
    },

    // Location (MRAID 3.0)
    getLocation: function() {
      return null; // Location not available
    },

    // Supports - MRAID 3.0 features
    supports: function(feature) {
      var supported = {
        'sms': false,
        'tel': false,
        'calendar': false,
        'storePicture': false,
        'inlineVideo': true,
        'vpaid': false,
        'location': false,
        // MRAID 3.0 additions
        'audioVolumeChange': true,
        'exposureChange': true
      };
      return supported[feature] || false;
    },

    // MRAID 3.0 Audio
    getAudioVolumePercentage: function() {
      return 100; // Volume at 100%
    },

    // Event handling
    addEventListener: function(event, listener) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(listener);

      // Only fire immediately if we've already transitioned to ready state
      // This handles late listeners that register after the ready event
      if (state !== 'loading') {
        if (event === 'ready') {
          setTimeout(function() { listener(); }, 0);
        }
        if (event === 'viewableChange' && viewable) {
          setTimeout(function() { listener(true); }, 0);
        }
        if (event === 'stateChange') {
          setTimeout(function() { listener(state); }, 0);
        }
      }
    },
    removeEventListener: function(event, listener) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(function(l) {
          return l !== listener;
        });
      }
    },

    // Helper to notify parent of MRAID calls
    _notifyParent: function(type, args) {
      try {
        window.parent.postMessage({
          type: 'mraid-event',
          event: type,
          args: args || [],
          timestamp: Date.now()
        }, '*');
      } catch (e) {
        // Ignore cross-origin errors
      }
    },

    // Actions
    open: function(url) {
      mraid._notifyParent('open', [url]);
      // Don't actually open - just notify parent for capture tool
    },
    close: function() {
      if (state === 'expanded') {
        state = 'default';
        mraid._fireEvent('stateChange', 'default');
        mraid._notifyParent('stateChange', ['default']);
        mraid._notifyParent('close');
      }
    },
    expand: function(url) {
      if (state === 'default') {
        state = 'expanded';
        mraid._fireEvent('stateChange', 'expanded');
        mraid._notifyParent('stateChange', ['expanded']);
        mraid._notifyParent('expand', [url]);
      }
    },
    resize: function() {
      mraid._notifyParent('resize');
      // No-op in mock
    },

    // Video (MRAID 3.0)
    playVideo: function(url) {
      mraid._notifyParent('playVideo', [url]);
      // Don't actually open - just notify parent for capture tool
    },

    // Store picture
    storePicture: function(url) {
      mraid._notifyParent('storePicture', [url]);
      // Not supported
    },

    // Calendar
    createCalendarEvent: function(params) {
      mraid._notifyParent('createCalendarEvent', [params]);
      // Not supported
    },

    // Internal: fire event to listeners
    _fireEvent: function(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(function(listener) {
          try {
            if (data !== undefined) {
              listener(data);
            } else {
              listener();
            }
          } catch (e) {
            console.warn('MRAID event listener error:', e);
          }
        });
      }
    }
  };

  // Fire events after DOM is ready - this ensures any video/image elements
  // defined after the MRAID script are available when events fire
  function fireEvents() {
    // Update state before firing events
    state = 'default';
    viewable = true;

    // Fire ready event
    mraid._fireEvent('ready');
    mraid._notifyParent('ready');

    // Fire stateChange event
    mraid._fireEvent('stateChange', 'default');
    mraid._notifyParent('stateChange', ['default']);

    // Fire viewableChange event
    mraid._fireEvent('viewableChange', true);
    mraid._notifyParent('viewableChange', [true]);

    console.log('[MRAID Mock] Events fired - state: default, viewable: true');
  }

  // Wait for DOM to be ready before firing events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireEvents);
  } else {
    // DOM already loaded, fire on next tick
    setTimeout(fireEvents, 0);
  }

  // Intercept window.open to prevent actual navigation
  // Log to parent instead for the event log
  var originalWindowOpen = window.open;
  window.open = function(url, target, features) {
    mraid._notifyParent('window.open', [url, target]);
    console.log('[MRAID Mock] Intercepted window.open:', url);
    // Return a mock window object to prevent errors
    return {
      closed: false,
      close: function() { this.closed = true; },
      focus: function() {},
      blur: function() {}
    };
  };

  // Also intercept anchor clicks that would navigate away
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }
    if (target && target.href && !target.href.startsWith('javascript:')) {
      e.preventDefault();
      e.stopPropagation();
      mraid._notifyParent('anchor', [target.href, target.target || '_self']);
      console.log('[MRAID Mock] Intercepted anchor click:', target.href);
    }
  }, true);

  console.log('[MRAID Mock] Initialized');

  // Intercept console.log to forward tagged events to parent
  // Looks for [AD_EVENT] prefix in log messages
  var originalConsoleLog = console.log;
  console.log = function() {
    // Forward to original console
    originalConsoleLog.apply(console, arguments);
    
    // Check for [AD_EVENT] tagged messages
    if (arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0] === '[AD_EVENT]') {
      var eventName = arguments[1] || 'console';
      var eventData = arguments[2] || null;
      try {
        window.parent.postMessage({
          type: 'mraid-event',
          event: eventName,
          args: eventData ? [eventData] : [],
          timestamp: Date.now()
        }, '*');
      } catch (e) {
        // Ignore cross-origin errors
      }
    }
  };

  // ============================================================
  // Network Request Interception for Tracking
  // ============================================================

  // Helper to check if URL looks like a tracking pixel
  function isTrackingUrl(url) {
    if (!url) return false;
    var trackingPatterns = [
      /impression/i, /pixel/i, /track/i, /beacon/i, /analytics/i,
      /click/i, /view/i, /event/i, /log/i, /collect/i, /ping/i,
      /1x1/i, /spacer/i, /clear\\.gif/i, /blank\\.gif/i
    ];
    return trackingPatterns.some(function(p) { return p.test(url); });
  }

  // Intercept Image constructor for tracking pixels
  var OriginalImage = window.Image;
  window.Image = function(width, height) {
    var img = new OriginalImage(width, height);
    var originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src') ||
                                 Object.getOwnPropertyDescriptor(img.__proto__, 'src');
    
    Object.defineProperty(img, 'src', {
      get: function() {
        return originalSrcDescriptor ? originalSrcDescriptor.get.call(this) : this.getAttribute('src');
      },
      set: function(value) {
        // Check if this is a tracking pixel (1x1 or tracking URL patterns)
        var isPixel = (width === 1 && height === 1) || 
                      (this.width === 1 && this.height === 1) ||
                      isTrackingUrl(value);
        
        if (isPixel && value) {
          mraid._notifyParent('pixel', [value, 'image']);
        }
        
        if (originalSrcDescriptor && originalSrcDescriptor.set) {
          originalSrcDescriptor.set.call(this, value);
        } else {
          this.setAttribute('src', value);
        }
      },
      configurable: true
    });
    
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;

  // Intercept navigator.sendBeacon for beacon tracking
  if (navigator.sendBeacon) {
    var originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      mraid._notifyParent('beacon', [url, data ? 'with data' : 'no data']);
      return originalSendBeacon(url, data);
    };
  }

  // Intercept fetch for POST requests (likely tracking)
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input.url || '');
    var method = (init && init.method) || 'GET';
    
    // Only log POST requests or tracking URLs
    if (method.toUpperCase() === 'POST' || isTrackingUrl(url)) {
      mraid._notifyParent('fetch', [url, method]);
    }
    
    return originalFetch.apply(window, arguments);
  };

  // Intercept XMLHttpRequest for POST requests
  var OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    var xhr = new OriginalXHR();
    var method = 'GET';
    var url = '';
    
    var originalOpen = xhr.open;
    xhr.open = function(m, u) {
      method = m;
      url = u;
      return originalOpen.apply(xhr, arguments);
    };
    
    var originalSend = xhr.send;
    xhr.send = function(data) {
      // Only log POST requests or tracking URLs
      if (method.toUpperCase() === 'POST' || isTrackingUrl(url)) {
        mraid._notifyParent('xhr', [url, method]);
      }
      return originalSend.apply(xhr, arguments);
    };
    
    return xhr;
  };
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;

  // Watch for dynamically added tracking images via MutationObserver
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.tagName === 'IMG') {
            var src = node.src || node.getAttribute('src');
            var w = node.width || node.getAttribute('width');
            var h = node.height || node.getAttribute('height');
            // Check for 1x1 pixels or tracking URLs
            if ((w == 1 && h == 1) || isTrackingUrl(src)) {
              mraid._notifyParent('pixel', [src, 'dom']);
            }
          }
        });
      });
    });
    
    // Start observing after DOM is ready
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

})();
`;
}
