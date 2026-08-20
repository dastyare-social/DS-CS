"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/dialog";
import { Button } from "@/components/button";
import ConfirmDialog from "@/components/confirm-dialog";
import { UploadIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { createStoryAction } from "@/lib/actions/stories";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoryCreated?: () => void;
};

export default function StoryPreviewModal({
  open,
  onOpenChange,
  onStoryCreated,
}: Props) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { items, selectFiles, clear, completedMedia, isUploading } =
    useMediaUpload();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localPreviewType, setLocalPreviewType] = useState<"image" | "video" | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const hasMedia = completedMedia.length > 0;
  const firstMedia = completedMedia[0];
  const uploadItem = items[0];
  const uploadProgress = uploadItem?.progress ?? 0;
  const uploadError = uploadItem?.error;

  // Show local preview immediately when a file is selected
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      clear();
      // Revoke previous local preview
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith("video/") ? "video" : "image";
      setLocalPreviewUrl(url);
      setLocalPreviewType(type);
      selectFiles([file]);
      e.target.value = "";
    },
    [selectFiles, clear, localPreviewUrl]
  );

  // Clean up local preview URL on unmount or when modal closes
  useEffect(() => {
    if (!open && localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
      setLocalPreviewType(null);
    }
  }, [open, localPreviewUrl]);

  // Once upload completes, clear local preview (use the uploaded URL instead)
  useEffect(() => {
    if (hasMedia && localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
      setLocalPreviewType(null);
    }
  }, [hasMedia, localPreviewUrl]);

  const showPreview = hasMedia || localPreviewUrl;
  const previewUrl = hasMedia && firstMedia?.url ? firstMedia.url : localPreviewUrl;
  const previewType = hasMedia ? (firstMedia?.kind as "image" | "video") : localPreviewType;

  const handlePublish = useCallback(async () => {
    if (!firstMedia) return;
    setPublishing(true);
    setError(null);
    try {
      await createStoryAction({
        url: firstMedia.url,
        width: firstMedia.width,
        height: firstMedia.height,
        duration: firstMedia.duration,
      });
      clear();
      onOpenChange(false);
      onStoryCreated?.();
    } catch (err: any) {
      console.error("Failed to create story", err);
      setError(err.message ?? "Failed to publish story");
    } finally {
      setPublishing(false);
    }
  }, [firstMedia, clear, onOpenChange, onStoryCreated]);

  const performClose = useCallback(() => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setLocalPreviewType(null);
    clear();
    setError(null);
    onOpenChange(false);
  }, [clear, onOpenChange, localPreviewUrl]);

  const handleClose = useCallback(() => {
    if (isUploading || publishing) {
      setConfirmDialogOpen(true);
      return;
    }
    performClose();
  }, [isUploading, publishing, performClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      // Block overlay click during upload/publish
      if (isUploading || publishing) {
        e.stopPropagation();
        return;
      }
      handleClose();
    },
    [isUploading, publishing, handleClose]
  );

  const isBusy = isUploading || publishing;

  return (
    <>
    <Dialog open={open} onOpenChange={isBusy ? undefined : handleClose}>
      <DialogContent
        className="w-[95vw] max-w-[420px] h-[80vh] bg-background/95 backdrop-blur-2xl border border-border/50 rounded-3xl p-0 overflow-hidden flex flex-col"
        showCloseButton={false}
        onPointerDownOutside={isBusy ? (e) => e.preventDefault() : undefined}
        onInteractOutside={isBusy ? (e) => e.preventDefault() : undefined}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border/30">
          <span className="text-lg font-semibold">
            {showPreview
              ? t("general.preview") || "Preview"
              : t("general.new_story") || "New Story"}
          </span>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-foreground/10 transition-colors cursor-pointer"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          {!showPreview && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border/50 hover:border-foreground/30 transition-colors cursor-pointer"
            >
              <UploadIcon className="size-10 text-foreground/40" />
              <span className="text-sm text-foreground/50">
                {t("general.tap_to_select") || "Tap to select photo or video"}
              </span>
            </button>
          )}

          {showPreview && previewUrl && previewType === "image" && (
            <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden">
              <img
                src={previewUrl}
                alt="Story preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {showPreview && previewUrl && previewType === "video" && (
            <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden">
              <video
                src={previewUrl}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Upload progress bar */}
        {isUploading && !hasMedia && (
          <div className="shrink-0 px-5 pb-2">
            <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-foreground/40">
                {Math.round(uploadProgress)}%
              </span>
              {uploadError && (
                <span className="text-xs text-red-500">{uploadError}</span>
              )}
            </div>
          </div>
        )}

        {/* Bottom Bar */}
        {showPreview && (
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-border/30">
            <button
              onClick={() => {
                if (isBusy) return;
                clear();
                if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
                setLocalPreviewUrl(null);
                setLocalPreviewType(null);
                fileInputRef.current?.click();
              }}
              disabled={isBusy}
              className="text-sm text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("general.change") || "Change"}
            </button>
            <Button
              variant="primary"
              onClick={handlePublish}
              disabled={!hasMedia || isBusy}
              className="text-sm px-4 py-1.5"
            >
              {publishing
                ? t("general.publishing") || "Publishing..."
                : t("general.publish") || "Publish"}
            </Button>
          </div>
        )}

        {error && (
          <div className="shrink-0 px-5 pb-3 text-sm text-red-500">{error}</div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={confirmDialogOpen}
      onOpenChange={setConfirmDialogOpen}
      title="Cancel Upload?"
      description="An upload is in progress. Closing now will cancel it."
      confirmLabel="Yes, Cancel"
      cancelLabel="Keep Editing"
      onConfirm={performClose}
      destructive
    />
    </>
  );
}
