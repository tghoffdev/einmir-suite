"use client";

import { useState, useCallback, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCSV, parseSize, detectSizeFromTag, generateNameFromTag } from "@/lib/bulk/csv-parser";
import { splitTags, extractTagIdentifier } from "@/lib/bulk/tag-splitter";
import { extractZip, validateZipFile } from "@/lib/html5/zip-loader";
import type { BatchItem, ExtractedZipInfo } from "@/types/bulk";

interface BulkUploadProps {
  onQueue: (items: BatchItem[], extractedZips?: ExtractedZipInfo[]) => void;
  disabled?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
}

type BulkInputMode = "csv" | "multi" | "files";

export function BulkUpload({
  onQueue,
  disabled = false,
  defaultWidth = 300,
  defaultHeight = 250,
}: BulkUploadProps) {
  const [mode, setMode] = useState<BulkInputMode>("csv");
  const [csvValue, setCsvValue] = useState("");
  const [multiValue, setMultiValue] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [multiPreview, setMultiPreview] = useState<{ count: number; delimiter: string }>({
    count: 0,
    delimiter: "none",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate unique ID
  const generateId = () => crypto.randomUUID();

  // Handle CSV input change
  const handleCsvChange = useCallback((value: string) => {
    setCsvValue(value);
    if (value.trim()) {
      const result = parseCSV(value);
      setCsvErrors(result.errors);
    } else {
      setCsvErrors([]);
    }
  }, []);

  // Handle multi-tag input change
  const handleMultiChange = useCallback((value: string) => {
    setMultiValue(value);
    if (value.trim()) {
      const result = splitTags(value);
      setMultiPreview({
        count: result.tags.length,
        delimiter: result.delimiter,
      });
    } else {
      setMultiPreview({ count: 0, delimiter: "none" });
    }
  }, []);

  // Parse CSV and queue items
  const handleQueueCsv = useCallback(() => {
    const result = parseCSV(csvValue);
    if (result.rows.length === 0) return;

    const items: BatchItem[] = result.rows.map((row, index) => {
      const size = row.size ? parseSize(row.size) : detectSizeFromTag(row.tag);
      return {
        id: generateId(),
        name: row.name || generateNameFromTag(row.tag, index),
        inputType: "tag" as const,
        content: row.tag,
        width: size?.width || defaultWidth,
        height: size?.height || defaultHeight,
        status: "pending" as const,
      };
    });

    onQueue(items);
    setCsvValue("");
    setCsvErrors([]);
  }, [csvValue, defaultWidth, defaultHeight, onQueue]);

  // Parse multi-tag and queue items
  const handleQueueMulti = useCallback(() => {
    const result = splitTags(multiValue);
    if (result.tags.length === 0) return;

    const items: BatchItem[] = result.tags.map((tag, index) => {
      const size = detectSizeFromTag(tag);
      return {
        id: generateId(),
        name: extractTagIdentifier(tag, index),
        inputType: "tag" as const,
        content: tag,
        width: size?.width || defaultWidth,
        height: size?.height || defaultHeight,
        status: "pending" as const,
      };
    });

    onQueue(items);
    setMultiValue("");
    setMultiPreview({ count: 0, delimiter: "none" });
  }, [multiValue, defaultWidth, defaultHeight, onQueue]);

  // Handle file drop/selection
  const handleFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter((f) =>
      f.name.toLowerCase().endsWith(".zip")
    );

    if (fileArray.length === 0) {
      setFileErrors(["No valid .zip files found"]);
      return;
    }

    setFiles((prev) => [...prev, ...fileArray]);
    setFileErrors([]);
  }, []);

  // Process files and queue
  const handleQueueFiles = useCallback(async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setFileErrors([]);

    const items: BatchItem[] = [];
    const extractedZips: ExtractedZipInfo[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const isValid = await validateZipFile(file);
        if (!isValid) {
          errors.push(`${file.name}: Invalid zip (no HTML files found)`);
          continue;
        }

        const result = await extractZip(file);
        const id = generateId();

        // Try to detect size from filename or content
        const sizeMatch = file.name.match(/(\d{2,4})x(\d{2,4})/);
        const width = sizeMatch ? parseInt(sizeMatch[1], 10) : defaultWidth;
        const height = sizeMatch ? parseInt(sizeMatch[2], 10) : defaultHeight;

        items.push({
          id,
          name: file.name.replace(/\.zip$/i, ""),
          inputType: "html5" as const,
          content: id, // Reference to extracted zip
          width,
          height,
          status: "pending" as const,
        });

        extractedZips.push({
          itemId: id,
          files: result.files,
          entryPoint: result.entryPoint,
          originalName: file.name,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${file.name}: ${msg}`);
      }
    }

    setIsProcessing(false);

    if (errors.length > 0) {
      setFileErrors(errors);
    }

    if (items.length > 0) {
      onQueue(items, extractedZips);
      setFiles([]);
    }
  }, [files, defaultWidth, defaultHeight, onQueue]);

  // Drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }, [disabled, handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Count parsed items for each mode
  const csvCount = csvValue.trim() ? parseCSV(csvValue).rows.length : 0;

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as BulkInputMode)}>
        <TabsList className="w-full">
          <TabsTrigger value="csv" className="flex-1">
            CSV Paste
          </TabsTrigger>
          <TabsTrigger value="multi" className="flex-1">
            Multi-Tag
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1">
            ZIP Files
          </TabsTrigger>
        </TabsList>

        {/* CSV Paste Tab */}
        <TabsContent value="csv" className="mt-3 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Format: tag, name, size (name and size optional)
            </Label>
            <Textarea
              placeholder={`"<script src='...'>", "Banner Ad", "300x250"\n"<script src='...'>", "Leaderboard", "728x90"`}
              value={csvValue}
              onChange={(e) => handleCsvChange(e.target.value)}
              className="h-[120px] font-mono text-xs resize-none"
              disabled={disabled}
            />
          </div>

          {csvErrors.length > 0 && (
            <div className="p-2 bg-destructive/10 rounded text-xs text-destructive space-y-1">
              {csvErrors.slice(0, 3).map((err, i) => (
                <div key={i}>{err}</div>
              ))}
              {csvErrors.length > 3 && (
                <div>...and {csvErrors.length - 3} more errors</div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {csvCount > 0 ? `${csvCount} ad${csvCount > 1 ? "s" : ""} detected` : "No ads detected"}
            </span>
            <Button
              onClick={handleQueueCsv}
              disabled={disabled || csvCount === 0}
              size="sm"
            >
              Add to Queue
            </Button>
          </div>
        </TabsContent>

        {/* Multi-Tag Tab */}
        <TabsContent value="multi" className="mt-3 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Separate tags with === or --- or blank lines
            </Label>
            <Textarea
              placeholder={`<script src="ad1.js"></script>\n\n===\n\n<script src="ad2.js"></script>`}
              value={multiValue}
              onChange={(e) => handleMultiChange(e.target.value)}
              className="h-[120px] font-mono text-xs resize-none"
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {multiPreview.count > 0
                ? `${multiPreview.count} tag${multiPreview.count > 1 ? "s" : ""} (${multiPreview.delimiter})`
                : "No tags detected"}
            </span>
            <Button
              onClick={handleQueueMulti}
              disabled={disabled || multiPreview.count === 0}
              size="sm"
            >
              Add to Queue
            </Button>
          </div>
        </TabsContent>

        {/* ZIP Files Tab */}
        <TabsContent value="files" className="mt-3 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            multiple
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />

          <div
            onClick={() => !disabled && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
              transition-colors duration-200
              ${isDragging ? "border-primary bg-primary/5" : "border-border"}
              ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="text-xl">📦</div>
              <span className="text-sm font-medium">
                Drop multiple .zip files here
              </span>
              <span className="text-xs text-muted-foreground">
                or click to browse
              </span>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-1 max-h-[100px] overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-2 py-1 bg-muted/50 rounded text-sm"
                >
                  <span className="truncate flex-1">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}

          {fileErrors.length > 0 && (
            <div className="p-2 bg-destructive/10 rounded text-xs text-destructive space-y-1">
              {fileErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {files.length > 0
                ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                : "No files selected"}
            </span>
            <Button
              onClick={handleQueueFiles}
              disabled={disabled || files.length === 0 || isProcessing}
              size="sm"
            >
              {isProcessing ? "Processing..." : "Add to Queue"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
