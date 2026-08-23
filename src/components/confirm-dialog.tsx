"use client";

import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
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
  title = "Are You Sure?",
  description = "are you sure you wanna cancel — changes wouldn't apply if you accept it",
  confirmLabel = "Accept",
  cancelLabel = "Keep Editing",
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
        className="w-[85vw] max-w-[340px] bg-white/50 backdrop-blur-3xl border-primary/10 rounded-3xl p-0 overflow-hidden text-secondary/90"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center gap-y-2 px-6 pt-6 pb-2 text-center">
          <span className="text-[20px]">{title}</span>
          <span className="text-[16px] text-secondary/70 leading-relaxed">
            {description}
          </span>
        </div>

        <div className="flex gap-x-2.5 justify-end px-5 py-4 mt-2.5">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            className="text-[18px] px-5"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className={cn(
              "text-[18px] px-5",
              destructive &&
                "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20",
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
