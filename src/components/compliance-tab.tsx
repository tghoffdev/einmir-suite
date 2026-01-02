"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyIcon, CheckIcon } from "lucide-react";
import {
  type ComplianceResult,
  type ComplianceCheck,
  type CheckStatus,
  getDSPOptions,
  getStatusColor,
  getStatusIcon,
  getDSPRules,
} from "@/lib/compliance";

// Map of check IDs that can be auto-fixed
const FIXABLE_CHECKS = new Set(["click-macro"]);

interface ComplianceTabProps {
  result?: ComplianceResult | null;
  onRun?: () => void;
  onReload?: () => void;
  selectedDSP?: string;
  onDSPChange?: (dsp: string) => void;
  hasContent?: boolean;
  currentTag?: string | null;
  onTagFix?: (fixedTag: string) => void;
}

export function ComplianceTab({
  result,
  onRun,
  onReload,
  selectedDSP = "generic",
  onDSPChange,
  hasContent = false,
  currentTag,
  onTagFix,
}: ComplianceTabProps) {
  const dspOptions = getDSPOptions();
  const dspRules = getDSPRules(selectedDSP);
  
  // Fixed tag state (when user clicks Fix, we store the result here)
  const [fixedTag, setFixedTag] = useState<string | null>(null);
  const [showFixedTag, setShowFixedTag] = useState(false);
  const [fixApplied, setFixApplied] = useState(false); // Track if fix was loaded
  const [copied, setCopied] = useState(false);

  // Apply a fix for a specific check
  const handleFix = (checkId: string) => {
    if (!currentTag) return;

    if (checkId === "click-macro") {
      const fixed = insertClickMacro(currentTag, dspRules.clickMacroPatterns[0]);
      if (fixed !== currentTag) {
        setFixedTag(fixed);
        setShowFixedTag(true);
        setFixApplied(false);
      }
    }
  };

  // Copy current tag (after fix) to clipboard
  const handleCopyCurrentTag = useCallback(async () => {
    if (!currentTag) return;
    try {
      await navigator.clipboard.writeText(currentTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [currentTag]);

  // Copy fixed tag to clipboard
  const handleCopy = useCallback(async () => {
    if (!fixedTag) return;
    try {
      await navigator.clipboard.writeText(fixedTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [fixedTag]);

  // Load the fixed tag into the preview and re-run compliance
  const handleLoadFixed = useCallback(() => {
    if (fixedTag && onTagFix) {
      onTagFix(fixedTag);
      setShowFixedTag(false);
      setFixApplied(true); // Mark that fix was applied
      // Re-run compliance after a short delay to let the tag load
      setTimeout(() => {
        onRun?.();
      }, 500);
    }
  }, [fixedTag, onTagFix, onRun]);

  // Reset fixed tag state when tag changes externally
  const resetFixedState = useCallback(() => {
    setFixedTag(null);
    setShowFixedTag(false);
    setFixApplied(false);
  }, []);

  // Check if a specific fix can be applied
  const canFix = (checkId: string): boolean => {
    if (!currentTag) return false;
    return FIXABLE_CHECKS.has(checkId);
  };

  return (
    <div className="space-y-2 pt-2">
      {/* DSP Selector */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-foreground/40 uppercase tracking-wider">
          Target DSP
        </div>
        <select
          value={selectedDSP}
          onChange={(e) => onDSPChange?.(e.target.value)}
          className="h-6 text-xs bg-background border border-border rounded px-2 text-foreground"
        >
          {dspOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Run Button or Results */}
      {!hasContent ? (
        <div className="text-center py-6 text-foreground/40 text-sm">
          <p>Load content to run compliance checks</p>
          <p className="text-xs mt-2 text-foreground/30">
            Paste a tag or upload an HTML5 zip
          </p>
        </div>
      ) : !result ? (
        <Button
          onClick={onRun}
          variant="outline"
          size="sm"
          className="w-full text-xs h-8"
        >
          Run Compliance Checks
        </Button>
      ) : (
        <div className="space-y-2">
          {/* Overall Status Banner */}
          <div
            className={`p-2 rounded border ${getStatusBorderColor(
              result.overallStatus
            )} ${getStatusBgColorSolid(result.overallStatus)}`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm ${getStatusTextColor(result.overallStatus)}`}>
                {getStatusIcon(result.overallStatus)}
              </span>
              <span className="text-sm font-medium">
                {getOverallStatusLabel(result.overallStatus, result.checks)}
              </span>
            </div>
          </div>

          {/* Copy Tag button - shown when compliance passes after fix */}
          {result.overallStatus === "pass" && fixApplied && (
            <Button
              onClick={handleCopyCurrentTag}
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-3 h-3 mr-1.5" />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon className="w-3 h-3 mr-1.5" />
                  Copy Fixed Tag
                </>
              )}
            </Button>
          )}

          {/* Re-run button - reloads ad and re-runs checks */}
          <Button
            onClick={onReload}
            variant="outline"
            size="sm"
            className="w-full text-xs h-7"
          >
            Reload & Re-check
          </Button>

          {/* Individual Checks */}
          <div className="space-y-1">
            {result.checks.map((check) => (
              <ComplianceCheckItem
                key={check.id}
                check={check}
                canFix={canFix(check.id) && check.status === "fail" && !fixedTag}
                onFix={() => handleFix(check.id)}
                dspMacro={dspRules.clickMacroPatterns[0]}
              />
            ))}
          </div>

          {/* Fixed Tag Export UI */}
          {fixedTag && (
            <div className="mt-3 p-2 rounded border border-cyan-500/30 bg-cyan-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cyan-400 font-medium">
                  ✓ Click Macro Added
                </span>
                <button
                  onClick={resetFixedState}
                  className="text-[10px] text-foreground/40 hover:text-foreground/60"
                >
                  ✕ Dismiss
                </button>
              </div>
              
              <div className="text-[10px] text-foreground/60">
                Added <code className="bg-cyan-500/10 px-1 rounded text-cyan-400">{dspRules.clickMacroPatterns[0]}</code> to the tag
              </div>

              {!showFixedTag ? (
                <Button
                  onClick={() => setShowFixedTag(true)}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  Generate Fixed Tag
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-7"
                    >
                      {copied ? "✓ Copied!" : "Copy Tag"}
                    </Button>
                    <Button
                      onClick={handleLoadFixed}
                      size="sm"
                      className="flex-1 text-xs h-7 bg-cyan-600 hover:bg-cyan-700"
                    >
                      Load & Re-check
                    </Button>
                  </div>
                  
                  <Textarea
                    value={fixedTag}
                    readOnly
                    className="h-24 text-[10px] font-mono bg-background/50 resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ComplianceCheckItemProps {
  check: ComplianceCheck;
  canFix?: boolean;
  onFix?: () => void;
  dspMacro?: string;
}

function ComplianceCheckItem({ check, canFix, onFix, dspMacro }: ComplianceCheckItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasItems = check.items && check.items.length > 0;

  return (
    <div
      className={`rounded bg-foreground/5 ${
        hasItems ? "cursor-pointer" : ""
      }`}
      onClick={() => hasItems && setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {hasItems && (
            <svg
              className={`w-3 h-3 text-foreground/40 shrink-0 transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
          <span className="text-xs truncate">{check.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {canFix && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFix?.();
              }}
              className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
              title={`Add ${dspMacro} to tag`}
            >
              Fix
            </button>
          )}
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${getStatusColor(
              check.status
            )}`}
          >
            {check.status === "pending" ? "..." : getStatusIcon(check.status)}{" "}
            {check.status === "pass"
              ? "Pass"
              : check.status === "fail"
              ? "Fail"
              : check.status === "warn"
              ? "Warn"
              : check.status === "pending"
              ? ""
              : "Skip"}
          </span>
        </div>
      </div>

      {/* Details */}
      {check.details && (
        <div className="px-1.5 pb-1.5 text-[10px] text-foreground/50 truncate">
          {check.details}
        </div>
      )}

      {/* Fix hint for failing checks */}
      {canFix && dspMacro && (
        <div className="px-1.5 pb-1.5 text-[10px] text-cyan-400/70">
          Click &quot;Fix&quot; to insert <code className="bg-cyan-500/10 px-1 rounded">{dspMacro}</code>
        </div>
      )}

      {/* Expanded Items */}
      {expanded && hasItems && (
        <div className="px-1.5 pb-1.5 space-y-1">
          {check.items!.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-[10px] bg-background/50 rounded px-2 py-1"
            >
              <span className="truncate text-foreground/70">{item.label}</span>
              <span
                className={`shrink-0 ${
                  item.status === "pass"
                    ? "text-emerald-400"
                    : item.status === "fail"
                    ? "text-red-400"
                    : item.status === "warn"
                    ? "text-amber-400"
                    : "text-foreground/50"
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getOverallStatusLabel(
  status: CheckStatus,
  checks: ComplianceCheck[]
): string {
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const pendingCount = checks.filter((c) => c.status === "pending").length;

  switch (status) {
    case "pass":
      return "All Checks Passed";
    case "fail":
      return `${failCount} Issue${failCount !== 1 ? "s" : ""} Found`;
    case "warn":
      return `${warnCount} Warning${warnCount !== 1 ? "s" : ""}`;
    case "pending":
      return "Checks Running...";
    case "skipped":
      return "Checks Skipped";
  }
}

function getStatusBorderColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "border-emerald-500/30";
    case "fail":
      return "border-red-500/30";
    case "warn":
      return "border-amber-500/30";
    case "pending":
      return "border-cyan-500/30";
    case "skipped":
      return "border-gray-500/30";
  }
}

function getStatusBgColorSolid(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "bg-emerald-500/10";
    case "fail":
      return "bg-red-500/10";
    case "warn":
      return "bg-amber-500/10";
    case "pending":
      return "bg-cyan-500/10";
    case "skipped":
      return "bg-gray-500/10";
  }
}

function getStatusTextColor(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "text-emerald-400";
    case "fail":
      return "text-red-400";
    case "warn":
      return "text-amber-400";
    case "pending":
      return "text-cyan-400";
    case "skipped":
      return "text-gray-400";
  }
}

/**
 * Insert a click macro into a tag
 * Handles different tag formats (Celtra, Google DCM, Adform, Sizmek, Flashtalking, generic)
 */
function insertClickMacro(tag: string, macro: string): string {
  // Handle Celtra tags - update the clickUrl parameter
  // Matches: 'clickUrl':'' or 'clickUrl':""  or "clickUrl":'' etc
  if (tag.includes("celtra-ad") || tag.includes("celtra.com")) {
    // Pattern to match clickUrl with empty string value
    const celtraResult = tag.replace(
      /(['"]clickUrl['"])\s*:\s*['"]['"]*/g,
      `$1:'${macro}'`
    );
    if (celtraResult !== tag) {
      return celtraResult;
    }
  }

  // Handle Google DCM tags - multiple patterns
  if (tag.includes("doubleclick.net") || tag.includes("dcmads") || tag.includes("googlesyndication")) {
    // Pattern 1: dc_dest_url parameter
    const dcDestResult = tag.replace(
      /(dc_dest_url\s*=\s*)["']?["']?/gi,
      `$1"${macro}"`
    );
    if (dcDestResult !== tag) {
      return dcDestResult;
    }
    
    // Pattern 2: data-dcm-click-tracker attribute
    const dcmClickResult = tag.replace(
      /(data-dcm-click-tracker\s*=\s*)["']?["']?/gi,
      `$1"${macro}"`
    );
    if (dcmClickResult !== tag) {
      return dcmClickResult;
    }
    
    // Pattern 3: Insert var clickTag before first script close or at head
    // For DCM tags that use window.clickTag
    if (tag.includes("</script>")) {
      return tag.replace(
        "</script>",
        `var clickTag = "${macro}";</script>`
      );
    }
  }

  // Handle Adform tags - dhtml.getVar pattern
  if (tag.includes("adform") || tag.includes("dhtml.getVar") || tag.includes("Adform.DHTML")) {
    // Pattern 1: clickTAGvalue variable
    const clickTAGValueResult = tag.replace(
      /(clickTAGvalue\s*=\s*)["']?["']?/gi,
      `$1"${macro}"`
    );
    if (clickTAGValueResult !== tag) {
      return clickTAGValueResult;
    }
    
    // Pattern 2: clickTAG in params object
    const adformParamsResult = tag.replace(
      /(['"]clickTAG['"])\s*:\s*['"]['"]*/gi,
      `$1:"${macro}"`
    );
    if (adformParamsResult !== tag) {
      return adformParamsResult;
    }
    
    // Pattern 3: Insert before Adform DHTML init
    if (tag.includes("Adform.DHTML")) {
      return tag.replace(
        /Adform\.DHTML/,
        `var clickTAG = "${macro}"; Adform.DHTML`
      );
    }
  }

  // Handle Sizmek tags - update clickTag or clickTAG
  if (tag.includes("sizmek") || tag.includes("serving-sys.com")) {
    const sizmekResult = tag.replace(
      /(clickTag|clickTAG)\s*=\s*["']["']*/gi,
      `$1="${macro}"`
    );
    if (sizmekResult !== tag) {
      return sizmekResult;
    }
  }

  // Handle Flashtalking tags
  if (tag.includes("flashtalking")) {
    const ftResult = tag.replace(
      /(clickTag\d*)\s*=\s*["']["']*/gi,
      `$1="${macro}"`
    );
    if (ftResult !== tag) {
      return ftResult;
    }
  }

  // Handle standard clickTag variable (let/const/var)
  const clickTagResult = tag.replace(
    /((?:var|let|const)\s+clickTag\s*=\s*)["']["']*/gi,
    `$1"${macro}"`
  );
  if (clickTagResult !== tag) {
    return clickTagResult;
  }

  // Handle empty clickTag assignment
  const emptyClickTagResult = tag.replace(
    /(clickTag\s*=\s*)["']["']*/gi,
    `$1"${macro}"`
  );
  if (emptyClickTagResult !== tag) {
    return emptyClickTagResult;
  }

  // If no known pattern found, try to insert before </head> or at the start of first <script>
  if (tag.includes("</head>")) {
    return tag.replace(
      "</head>",
      `<script>var clickTag = "${macro}";</script>\n</head>`
    );
  }

  // As a fallback, prepend a script tag
  if (tag.includes("<script")) {
    return tag.replace(
      /<script/i,
      `<script>var clickTag = "${macro}";</script>\n<script`
    );
  }

  // Last resort: prepend to tag
  return `<script>var clickTag = "${macro}";</script>\n${tag}`;
}
