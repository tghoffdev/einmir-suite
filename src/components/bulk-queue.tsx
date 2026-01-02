"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { BatchItem } from "@/types/bulk";

interface BulkQueueProps {
  items: BatchItem[];
  onItemsChange: (items: BatchItem[]) => void;
  onStartProcessing: () => void;
  onClear: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

const SECONDS_PER_AD = 8;

export function BulkQueue({
  items,
  onItemsChange,
  onStartProcessing,
  onClear,
  disabled = false,
  isProcessing = false,
}: BulkQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Toggle single item selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle all selection
  const toggleAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }, [items, selectedIds.size]);

  // Remove selected items
  const removeSelected = useCallback(() => {
    onItemsChange(items.filter((i) => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
  }, [items, selectedIds, onItemsChange]);

  // Move item up
  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  // Move item down
  const moveDown = useCallback((index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    onItemsChange(newItems);
  }, [items, onItemsChange]);

  // Start editing item name
  const startEditing = useCallback((item: BatchItem) => {
    setEditingId(item.id);
    setEditValue(item.name);
  }, []);

  // Save edited name
  const saveEdit = useCallback(() => {
    if (!editingId || !editValue.trim()) {
      setEditingId(null);
      return;
    }

    onItemsChange(
      items.map((item) =>
        item.id === editingId ? { ...item, name: editValue.trim() } : item
      )
    );
    setEditingId(null);
    setEditValue("");
  }, [editingId, editValue, items, onItemsChange]);

  // Update item size
  const updateSize = useCallback((id: string, dimension: "width" | "height", value: number) => {
    onItemsChange(
      items.map((item) =>
        item.id === id ? { ...item, [dimension]: value } : item
      )
    );
  }, [items, onItemsChange]);

  // Estimated time
  const estimatedSeconds = items.length * SECONDS_PER_AD;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-6 text-center">
        <div className="text-muted-foreground">
          <div className="text-2xl mb-2">📋</div>
          <div className="text-sm">Queue is empty</div>
          <div className="text-xs mt-1">Add ads using the input above</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={selectedIds.size === items.length}
            onCheckedChange={toggleAll}
            disabled={disabled || isProcessing}
          />
          <span className="text-sm font-medium">
            {items.length} ad{items.length > 1 ? "s" : ""} queued
          </span>
          {selectedIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={removeSelected}
              disabled={disabled || isProcessing}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              Remove ({selectedIds.size})
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={disabled || isProcessing}
          className="h-7 text-xs"
        >
          Clear All
        </Button>
      </div>

      {/* Item list */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded text-sm
              ${selectedIds.has(item.id) ? "bg-primary/10" : "bg-muted/30"}
              ${item.status === "error" ? "border border-destructive/50" : ""}
            `}
          >
            <Checkbox
              checked={selectedIds.has(item.id)}
              onCheckedChange={() => toggleSelection(item.id)}
              disabled={disabled || isProcessing}
            />

            <span className="text-xs text-muted-foreground w-6">
              {String(index + 1).padStart(2, "0")}
            </span>

            {/* Name (editable) */}
            {editingId === item.id ? (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="h-6 text-xs flex-1"
                autoFocus
              />
            ) : (
              <span
                className="flex-1 truncate cursor-pointer hover:text-primary"
                onClick={() => !disabled && !isProcessing && startEditing(item)}
                title={item.name}
              >
                {item.name}
              </span>
            )}

            {/* Size */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Input
                type="number"
                value={item.width}
                onChange={(e) => updateSize(item.id, "width", parseInt(e.target.value) || 0)}
                className="h-6 w-14 text-xs text-center"
                disabled={disabled || isProcessing}
              />
              <span>×</span>
              <Input
                type="number"
                value={item.height}
                onChange={(e) => updateSize(item.id, "height", parseInt(e.target.value) || 0)}
                className="h-6 w-14 text-xs text-center"
                disabled={disabled || isProcessing}
              />
            </div>

            {/* Type badge */}
            <span
              className={`
                px-1.5 py-0.5 rounded text-[10px] font-medium uppercase
                ${item.inputType === "html5" ? "bg-cyan-500/20 text-cyan-400" : "bg-amber-500/20 text-amber-400"}
              `}
            >
              {item.inputType === "html5" ? "ZIP" : "TAG"}
            </span>

            {/* Reorder buttons */}
            <div className="flex">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-xs"
                onClick={() => moveUp(index)}
                disabled={disabled || isProcessing || index === 0}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-xs"
                onClick={() => moveDown(index)}
                disabled={disabled || isProcessing || index === items.length - 1}
              >
                ↓
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">
          Est. time: ~{estimatedMinutes} min ({estimatedSeconds}s)
        </span>
        <Button
          onClick={onStartProcessing}
          disabled={disabled || isProcessing || items.length === 0}
          className="gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>Start Bulk Proof Collection</>
          )}
        </Button>
      </div>
    </div>
  );
}
