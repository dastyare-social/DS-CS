"use client";

import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are You Sure? —",
  description = "are you sure you wanna cancel — changes wouldn't apply if you accept it",
  confirmLabel = "Yes, Do It",
  cancelLabel = "No, I Don't",
  onConfirm,
  onCancel,
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
        className="w-[85vw] max-w-3xs bg-background/80 backdrop-blur-3xl border border-secondary/10 rounded-3xl p-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="flex flex-col justify-center items-center gap-y-0.5 py-6 px-6 text-center">
          <span className="text-xl">{title}</span>
          <span className="opacity-80 leading-[1.25rem]">{description}</span>

          <div className="flex flex-col gap-y-2.5 w-full mt-4">
            <Button
              type="button"
              variant="primary"
              className="w-full text-md md:text-md"
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full text-md md:text-md"
              onClick={handleCancel}
            >
              {cancelLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
