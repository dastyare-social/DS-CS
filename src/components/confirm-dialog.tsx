"use client";

import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  destructive?: boolean;
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent
        className="w-[85vw] max-w-[340px] bg-background/95 backdrop-blur-2xl border border-border/50 rounded-3xl p-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-2 text-center">
          <span className="text-lg font-semibold">{title}</span>
          {description && (
            <span className="text-sm text-foreground/60 leading-relaxed">
              {description}
            </span>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border/30">
          <Button
            variant="secondary"
            onClick={handleCancel}
            className="flex-1 text-sm py-2"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "secondary" : "primary"}
            onClick={handleConfirm}
            className={cn(
              "flex-1 text-sm py-2",
              destructive && "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
