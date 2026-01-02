"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZipUpload } from "@/components/zip-upload";
import { SampleBrowser } from "@/components/sample-browser";
import type { ZipLoadResult } from "@/lib/html5/zip-loader";

/**
 * TagInput Component
 *
 * Textarea for pasting raw MRAID ad tags, plus HTML5 zip upload.
 * Includes toggle for bulk mode.
 */

export type InputMode = "tag" | "html5";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  onHtml5Load: (result: ZipLoadResult) => void;
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  onSelectSampleTag: (tag: string, width: number, height: number) => void;
  onSelectSampleBundle: (path: string, width: number, height: number) => void;
  disabled?: boolean;
  isBulkMode?: boolean;
  onBulkModeChange?: (isBulk: boolean) => void;
}

export function TagInput({
  value,
  onChange,
  onLoad,
  onHtml5Load,
  inputMode,
  onInputModeChange,
  onSelectSampleTag,
  onSelectSampleBundle,
  disabled,
  isBulkMode = false,
  onBulkModeChange,
}: TagInputProps) {

  return (
    <div className="space-y-2">
      {/* Bulk mode toggle */}
      {onBulkModeChange && (
        <div className="flex justify-end">
          <Button
            variant={isBulkMode ? "default" : "outline"}
            size="sm"
            onClick={() => onBulkModeChange(!isBulkMode)}
            className="h-7 text-xs gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {isBulkMode ? "Bulk Mode" : "Bulk"}
          </Button>
        </div>
      )}

      <Tabs value={inputMode} onValueChange={(v) => onInputModeChange(v as InputMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="tag" className="flex-1">
            Paste Tag
          </TabsTrigger>
          <TabsTrigger value="html5" className="flex-1">
            Upload HTML5
          </TabsTrigger>
        </TabsList>

      <TabsContent value="tag" className="mt-3">
        <div className="space-y-2">
          <Textarea
            placeholder="Paste a tag here..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-[150px] max-h-[150px] overflow-y-auto font-mono text-sm resize-none"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <Button onClick={onLoad} disabled={disabled || !value.trim()}>
              Load Tag
            </Button>
            <SampleBrowser
              onSelectTag={onSelectSampleTag}
              onSelectBundle={onSelectSampleBundle}
              trigger={
                <Button variant="outline" disabled={disabled}>
                  Samples
                </Button>
              }
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="html5" className="mt-3">
        <ZipUpload onLoad={onHtml5Load} disabled={disabled} />
      </TabsContent>
    </Tabs>
    </div>
  );
}
