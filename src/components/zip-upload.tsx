"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { extractZip, validateZipFile, type ZipLoadResult } from "@/lib/html5/zip-loader";

interface ZipUploadProps {
  onLoad: (result: ZipLoadResult) => void;
  disabled?: boolean;
}

export function ZipUpload({ onLoad, disabled = false }: ZipUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsLoading(true);

      try {
        // Validate file type
        if (!file.name.toLowerCase().endsWith(".zip")) {
          throw new Error("Please upload a .zip file");
        }

        // Validate zip contents
        const isValid = await validateZipFile(file);
        if (!isValid) {
          throw new Error("Invalid zip file. Must contain at least one HTML file.");
        }

        // Extract zip
        const result = await extractZip(file);
        setLoadedFile(file.name);
        onLoad(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load zip file";
        setError(message);
        setLoadedFile(null);
      } finally {
        setIsLoading(false);
      }
    },
    [onLoad]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [disabled, handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? "border-primary bg-primary/5" : "border-border"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"}
          ${error ? "border-destructive" : ""}
        `}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Extracting...</span>
          </div>
        ) : loadedFile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="text-2xl">📦</div>
            <span className="text-sm font-medium">{loadedFile}</span>
            <span className="text-xs text-muted-foreground">
              Click or drag to replace
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-2xl">📁</div>
            <span className="text-sm font-medium">
              Drop HTML5 zip here or click to browse
            </span>
            <span className="text-xs text-muted-foreground">
              Supports exported HTML5 ad packages
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {loadedFile && (
        <Button
          onClick={() => {
            setLoadedFile(null);
            setError(null);
          }}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
