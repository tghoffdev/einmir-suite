/**
 * Ad Tag Macro Detector
 *
 * Extracts macro placeholders from ad tags across various formats.
 */

export interface DetectedMacro {
  /** The full macro string as found in tag (e.g., "[GEO_LOCATION]") */
  raw: string;
  /** The macro name without delimiters (e.g., "GEO_LOCATION") */
  name: string;
  /** The format/style of the macro */
  format: MacroFormat;
  /** Number of occurrences in the tag */
  count: number;
}

export type MacroFormat =
  | "bracket"      // [MACRO]
  | "double-percent" // %%MACRO%%
  | "dollar-brace" // ${MACRO}
  | "double-brace" // {{MACRO}} or {{macro}}
  | "double-bracket" // [[MACRO]]
  | "percent-brace" // %{MACRO}
  | "hash"         // #MACRO#
  | "underscore"   // __MACRO__
  | "exclaim"      // !MACRO!
  | "at-brace"     // @{MACRO}
  | "clicktag"     // window.clickTag, window.clickTAG
  | "queryparam";  // ?clickTag=, ?name=

interface MacroPattern {
  format: MacroFormat;
  regex: RegExp;
  extract: (match: RegExpMatchArray) => string;
}

const MACRO_PATTERNS: MacroPattern[] = [
  // [MACRO] - Common in many ad servers
  {
    format: "bracket",
    regex: /\[([A-Z][A-Z0-9_]{2,})\]/g,
    extract: (m) => m[1],
  },
  // %%MACRO%% - Google DCM / Campaign Manager
  {
    format: "double-percent",
    regex: /%%([A-Z][A-Z0-9_]{2,})%%/g,
    extract: (m) => m[1],
  },
  // ${MACRO} - Programmatic / SSP style
  {
    format: "dollar-brace",
    regex: /\$\{([A-Z][A-Z0-9_]{2,})\}/g,
    extract: (m) => m[1],
  },
  // {{MACRO}} or {{macro}} - Handlebars / Mustache style (case insensitive)
  {
    format: "double-brace",
    regex: /\{\{([A-Za-z][A-Za-z0-9_]{1,})\}\}/g,
    extract: (m) => m[1].toUpperCase(),
  },
  // [[MACRO]] - Some ad servers
  {
    format: "double-bracket",
    regex: /\[\[([A-Z][A-Z0-9_]{2,})\]\]/g,
    extract: (m) => m[1],
  },
  // %{MACRO} - Ruby/ERB style
  {
    format: "percent-brace",
    regex: /%\{([A-Z][A-Z0-9_]{2,})\}/g,
    extract: (m) => m[1],
  },
  // #MACRO# - Some legacy systems
  {
    format: "hash",
    regex: /#([A-Z][A-Z0-9_]{2,})#/g,
    extract: (m) => m[1],
  },
  // __MACRO__ - Dunder style (allow short names like __CB__, __TS__)
  {
    format: "underscore",
    regex: /__([A-Z][A-Z0-9_]{1,})__/g,
    extract: (m) => m[1],
  },
  // @{MACRO} - Some DSPs
  {
    format: "at-brace",
    regex: /@\{([A-Z][A-Z0-9_]{2,})\}/g,
    extract: (m) => m[1],
  },
  // window.clickTag / window.clickTAG - HTML5 bundle click tracking
  {
    format: "clicktag",
    regex: /window\.(clickTag|clickTAG)\b/g,
    extract: () => "CLICKTAG",
  },
  // ?clickTag= or ?name= - Query param based macros in HTML5
  {
    format: "queryparam",
    regex: /[?&](clickTag|clicktag|name|city|offer|headline|body|cta|pill)=/gi,
    extract: (m) => m[1].toUpperCase(),
  },
];

// Common macro names for reference
export const KNOWN_MACROS: Record<string, string> = {
  // Click/URL macros
  CLICK_URL: "Click tracking URL",
  CLICK: "Click URL",
  DEST_URL: "Destination URL",
  LANDING_PAGE: "Landing page URL",
  CLICKURL: "Click URL",
  CLICK_URL_ENC: "Encoded click URL",
  CLICK_URL_ESC: "Escaped click URL",

  // Cache busting
  CACHEBUSTER: "Cache buster value",
  CACHE_BUSTER: "Cache buster value",
  CB: "Cache buster (short)",
  RANDOM: "Random number",
  TIMESTAMP: "Unix timestamp",
  TS: "Timestamp (short)",

  // Geographic
  GEO_LOCATION: "Geographic location",
  GEO: "Geographic data",
  COUNTRY: "Country code",
  REGION: "Region/State",
  CITY: "City name",
  ZIP: "Postal/ZIP code",
  DMA: "DMA code",

  // Device/User
  DEVICE_ID: "Device identifier",
  USER_ID: "User identifier",
  USER_AGENT: "User agent string",
  IP_ADDRESS: "IP address",

  // Programmatic
  AUCTION_PRICE: "Winning bid price",
  AUCTION_ID: "Auction identifier",
  BID_PRICE: "Bid price",
  WINNING_PRICE: "Winning price",

  // Placement
  PLACEMENT_ID: "Placement identifier",
  SITE_ID: "Site identifier",
  PAGE_URL: "Page URL",
  DOMAIN: "Domain name",

  // Creative
  CREATIVE_ID: "Creative identifier",
  AD_ID: "Ad identifier",
  CAMPAIGN_ID: "Campaign identifier",
  LINE_ITEM_ID: "Line item identifier",

  // HTML5 bundle macros
  CLICKTAG: "Click tracking URL (HTML5)",
  NAME: "Name/title text",
  OFFER: "Offer/promo text",
  HEADLINE: "Headline text",
  BODY: "Body copy text",
  CTA: "Call to action text",
  PILL: "Pill/badge text",
};

/**
 * Detect all macros in an ad tag
 */
export function detectMacros(tag: string): DetectedMacro[] {
  const macroMap = new Map<string, DetectedMacro>();

  for (const pattern of MACRO_PATTERNS) {
    const matches = tag.matchAll(pattern.regex);

    for (const match of matches) {
      const raw = match[0];
      const name = pattern.extract(match);
      const key = `${pattern.format}:${name}`;

      if (macroMap.has(key)) {
        macroMap.get(key)!.count++;
      } else {
        macroMap.set(key, {
          raw,
          name,
          format: pattern.format,
          count: 1,
        });
      }
    }
  }

  // Sort by name
  return Array.from(macroMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Get description for a known macro
 */
export function getMacroDescription(name: string): string | undefined {
  return KNOWN_MACROS[name];
}

/**
 * Get format display name
 */
export function getFormatDisplay(format: MacroFormat): string {
  const displays: Record<MacroFormat, string> = {
    "bracket": "[...]",
    "double-percent": "%%...%%",
    "dollar-brace": "${...}",
    "double-brace": "{{...}}",
    "double-bracket": "[[...]]",
    "percent-brace": "%{...}",
    "hash": "#...#",
    "underscore": "__...__",
    "exclaim": "!...!",
    "at-brace": "@{...}",
    "clicktag": "window.clickTag",
    "queryparam": "?param=",
  };
  return displays[format];
}

/**
 * Registry to track replaced macro nodes for live editing
 * Maps macro.raw -> array of { node, originalText, template }
 */
interface ReplacedNode {
  node: Text;
  originalText: string;  // The full original text of the node
  template: string;      // Template with placeholder for this macro
}

const macroReplacementRegistry = new WeakMap<HTMLIFrameElement, Map<string, ReplacedNode[]>>();

/**
 * Clear the replacement registry for an iframe (call on reload)
 */
export function clearMacroRegistry(iframe: HTMLIFrameElement): void {
  macroReplacementRegistry.delete(iframe);
}

/**
 * Replace a macro in the iframe DOM with a value
 * Tracks replaced nodes for subsequent live updates
 */
export function replaceMacroInDOM(
  iframe: HTMLIFrameElement,
  macro: DetectedMacro,
  value: string
): number {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return 0;

    // Get or create registry for this iframe
    let registry = macroReplacementRegistry.get(iframe);
    if (!registry) {
      registry = new Map();
      macroReplacementRegistry.set(iframe, registry);
    }

    // Check if we've already tracked nodes for this macro
    const existingNodes = registry.get(macro.raw);

    if (existingNodes && existingNodes.length > 0) {
      // Update existing tracked nodes
      let updateCount = 0;
      for (const { node, template } of existingNodes) {
        // Check if node is still in the document
        if (doc.body.contains(node)) {
          node.textContent = template.replace(`__MACRO_PLACEHOLDER_${macro.raw}__`, value);
          updateCount++;
        }
      }
      console.log(`[MacroDetector] Updated ${updateCount} tracked nodes for ${macro.raw}`);
      return updateCount;
    }

    // First time - find and track nodes containing this macro
    let replacementCount = 0;
    const walker = doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToTrack: ReplacedNode[] = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.textContent || "";
      if (text.includes(macro.raw)) {
        // Create a template with a unique placeholder for this macro
        const template = text.split(macro.raw).join(`__MACRO_PLACEHOLDER_${macro.raw}__`);
        nodesToTrack.push({
          node,
          originalText: text,
          template,
        });
        // Apply the initial replacement
        node.textContent = template.replace(`__MACRO_PLACEHOLDER_${macro.raw}__`, value);
        replacementCount++;
      }
    }

    // Store tracked nodes
    if (nodesToTrack.length > 0) {
      registry.set(macro.raw, nodesToTrack);
    }

    console.log(`[MacroDetector] Replaced ${replacementCount} occurrences of ${macro.raw}`);
    return replacementCount;
  } catch (e) {
    console.warn("[MacroDetector] Failed to replace macro in DOM:", e);
    return 0;
  }
}

/**
 * Reset a macro to its original value in the DOM
 */
export function resetMacroInDOM(
  iframe: HTMLIFrameElement,
  macro: DetectedMacro
): void {
  const registry = macroReplacementRegistry.get(iframe);
  if (!registry) return;

  const nodes = registry.get(macro.raw);
  if (!nodes) return;

  const doc = iframe.contentDocument;
  if (!doc) return;

  for (const { node, originalText } of nodes) {
    if (doc.body.contains(node)) {
      node.textContent = originalText;
    }
  }

  // Remove from registry so next edit starts fresh
  registry.delete(macro.raw);
  console.log(`[MacroDetector] Reset ${macro.raw} to original value`);
}

export async function scanIframeForMacros(iframe: HTMLIFrameElement): Promise<DetectedMacro[]> {
  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) return [];

    // Get HTML content
    const html = doc.documentElement?.outerHTML || "";

    // Get inline script contents
    const scripts = doc.querySelectorAll("script");
    const scriptContents: string[] = [];

    for (const script of Array.from(scripts)) {
      if (script.src) {
        // External script - fetch it
        try {
          const response = await fetch(script.src);
          if (response.ok) {
            const text = await response.text();
            scriptContents.push(text);
          }
        } catch (e) {
          console.warn("[MacroDetector] Failed to fetch script:", script.src, e);
        }
      } else if (script.textContent) {
        // Inline script
        scriptContents.push(script.textContent);
      }
    }

    const content = html + "\n" + scriptContents.join("\n");
    console.log("[MacroDetector] Scanned content length:", content.length);
    return detectMacros(content);
  } catch (e) {
    console.warn("[MacroDetector] Failed to scan iframe:", e);
    return [];
  }
}
