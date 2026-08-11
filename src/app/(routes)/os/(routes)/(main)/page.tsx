"use client";

import Message from "@/components/post";
import Loader from "@/components/loader";
import { usePosts } from "@/lib/hooks/use-posts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  createPost,
  togglePinPost,
  updatePostContent,
  viewPost,
} from "@/lib/actions/posts";
import {
  GalleryVerticalEndIcon,
  PinIcon,
  PlayIcon,
  SendHorizonalIcon,
  XIcon,
} from "lucide-react";
import { filterString } from "@/lib/filters";
import Header from "@/components/header";
import type { PostWithReactions } from "@/lib/api/posts";
import { app_config } from "@/config/app";
import { Locale } from "@/config/locale";
import {
  buildMediaInputs,
  inferPostType,
  useMediaUpload,
} from "@/lib/hooks/use-media-upload";

const Page = () => {
  const t = useTranslations();

  const locale = useLocale() as Locale;

  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const pinnedBarRef = useRef<HTMLDivElement | null>(null);
  const [showPinnedBar, setShowPinnedBar] = useState(true);
  const [pageHeight, setPageHeight] = useState<number | null>(null);

  // Selected media state (upload + progress handled by the hook)
  const {
    items: selectedFiles,
    isUploading,
    completedMedia,
    hasError,
    selectFiles,
    removeFile,
    clear,
  } = useMediaUpload();

  // only update header/footer CSS variables
  const updateHeaderFooterOffsets = () => {
    requestAnimationFrame(() => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const footerHeight = footerRef.current?.offsetHeight ?? 0;
      const pinnedBarHeight =
        showPinnedBar && pinnedBarRef.current
          ? pinnedBarRef.current.offsetHeight
          : 0;
      document.documentElement.style.setProperty(
        "--chat-header-height",
        `${headerHeight + 20}px`
      );
      document.documentElement.style.setProperty(
        "--chat-footer-height",
        `${footerHeight + 20}px`
      );
      document.documentElement.style.setProperty(
        "--pinned-bar-height",
        `${pinnedBarHeight}px`
      );
    });
  };

  const updatePageHeight = () => {
    const h = window.innerHeight;
    setPageHeight(h);
    document.documentElement.style.setProperty("--page-height", `${h}px`);
    updateHeaderFooterOffsets();
  };

  useEffect(() => {
    // get the height of the screen before loading anything
    updatePageHeight();
    window.addEventListener("resize", updatePageHeight);
    return () => window.removeEventListener("resize", updatePageHeight);
  }, []);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState<string>("");
  const MAX_LINES = 6;

  // Reference to the scroll container (root div)
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    // Auto-resize textarea
    el.style.height = "auto"; // reset to let scrollHeight shrink when deleting
    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight || "20");
    const paddingTop = parseFloat(computed.paddingTop || "0");
    const paddingBottom = parseFloat(computed.paddingBottom || "0");

    const maxHeight = lineHeight * MAX_LINES + paddingTop + paddingBottom;

    // scrollHeight includes padding, so just cap it directly
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;

    const reachedMaxLines = el.scrollHeight >= maxHeight;
    el.style.overflowY = reachedMaxLines ? "auto" : "hidden";

    // keep header/footer offsets in sync
    updateHeaderFooterOffsets();

    // On mobile, ensure bottom of page remains visible while typing
    const pageEl = pageRef.current;
    if (pageEl) {
      requestAnimationFrame(() => {
        pageEl.scrollTop = pageEl.scrollHeight;
      });
    }
  }, [inputValue]);

  const {
    posts,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    addPost,
    removePost,
    updatePost,
  } = usePosts(8);

  // Pinned posts + editing state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [activePinnedIndex, setActivePinnedIndex] = useState(0);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(
    null
  );

  const pinnedPosts = useMemo(
    () => posts.filter((post) => post.pinnedAt != null),
    [posts]
  );

  const activeEditPost = useMemo(
    () =>
      editingPostId
        ? posts.find((post) => post.id === editingPostId)
        : undefined,
    [editingPostId, posts]
  );

  useEffect(() => {
    // when posts change, header height might change, so just update offsets
    updateHeaderFooterOffsets();
  }, [posts.length]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const viewedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoading && !isLoadingMore) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (!entry.isIntersecting) return;

          const id = entry.target.getAttribute("data-message-id");
          if (!id) return;
          if (viewedIdsRef.current.has(id)) return;

          viewedIdsRef.current.add(id);

          try {
            await viewPost(id);
          } catch (err) {
            console.error("Failed to send view", err);
          }
        });
      },
      {
        root: container,
        threshold: 0.4,
      }
    );

    const items =
      container.querySelectorAll<HTMLDivElement>("[data-message-id]");
    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [posts.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePlay = (event: Event) => {
      const target = event.target as HTMLMediaElement | null;
      if (
        !target ||
        (target.tagName !== "AUDIO" && target.tagName !== "VIDEO")
      ) {
        return;
      }

      const mediaElements =
        document.querySelectorAll<HTMLMediaElement>("audio, video");

      mediaElements.forEach((el) => {
        if (el !== target && !el.paused) {
          el.pause();
          const pauseEvent = new Event("forcedpause");
          el.dispatchEvent(pauseEvent);
        }
      });
    };

    document.addEventListener("play", handlePlay, true);

    return () => {
      document.removeEventListener("play", handlePlay, true);
    };
  }, []);

  // =========================
  // send text message with media (with optimistic UI)
  // =========================
  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();

    // Editing an existing post
    if (editingPostId) {
      if (!trimmed) return;
      const target = posts.find((p) => p.id === editingPostId);
      if (target) {
        // Optimistically update
        updatePost({ ...target, content: trimmed, updatedAt: new Date() });
        try {
          await updatePostContent(editingPostId, trimmed);
        } catch (err) {
          console.error("Failed to edit post", err);
          updatePost({ ...target, content: trimmed });
        }
      }
      setEditingPostId(null);
      setInputValue("");
      return;
    }

    const validUrls = completedMedia.map((m) => m.url);
    if (!trimmed && validUrls.length === 0) return;
    if (isUploading) return; // Don't send while uploading

    // Prepare media inputs from successfully uploaded URLs (with type + dimensions)
    const mediaInputs = buildMediaInputs(selectedFiles);

    // Determine post type based on the uploaded media kind
    const postType = inferPostType(selectedFiles);

    // Optimistic post: must conform to PostWithReactions
    const tempId = `temp-${Date.now()}`;

    const optimisticPost: PostWithReactions = {
      id: tempId,
      type: postType,
      content: trimmed || null,
      views: "0",
      pinnedAt: null,
      media: validUrls.length > 0 ? { url: validUrls[0] } as any : null,
      createdAt: new Date(),
      updatedAt: null,
      reactions: [],
    };

    // 1) Optimistically add post
    addPost(optimisticPost);

    // 2) Clear input + reset media state
    setInputValue("");
    clear();
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.overflowY = "hidden";
    }

    // 3) Scroll to latest
    const pageEl = pageRef.current;
    if (pageEl) {
      requestAnimationFrame(() => {
        pageEl.scrollTop = pageEl.scrollHeight;
      });
    }

    try {
      const createdPost = await createPost(trimmed || null, mediaInputs.length > 0 ? mediaInputs : undefined);

      // 4) Remove the optimistic post and then add the real one
      removePost(tempId);
      
      // Handle multiple posts created (for mixed media types)
      if ((createdPost as any)._multiple) {
        const multipleResult = createdPost as any;
        multipleResult.posts.forEach((post: PostWithReactions) => addPost(post));
      } else {
        addPost(createdPost);
      }
    } catch (err) {
      console.error("Error sending message", err);
      // If send failed, remove optimistic post
      removePost(tempId);
      // Optionally: show a toast or mark as failed instead.
    }
  };

  // handle file selection - accept multiple files
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Allow re-selecting the same file
    e.target.value = "";

    // Add new files to selection (up to max) and start uploading
    selectFiles(files);
  };

  // remove a selected file from the preview
  const handleRemoveFile = (index: number) => {
    removeFile(index);
  };

  // =========================
  // pinned posts
  // =========================
  const resolvePostPreview = (post?: PostWithReactions) => {
    if (!post) return "";
    if (post.type === "text") return post.content ?? "";
    return `${post.type.charAt(0).toUpperCase()}${post.type.slice(1)} Post`;
  };

  const scrollToPost = (targetId: string) => {
    const el = document.getElementById(`message-${targetId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedPostId(targetId);
    setTimeout(() => {
      setHighlightedPostId((current) =>
        current === targetId ? null : current
      );
    }, 3000);
  };

  const handlePinnedBarClick = () => {
    if (pinnedPosts.length === 0) return;
    const safeIndex =
      activePinnedIndex >= pinnedPosts.length ? 0 : activePinnedIndex;
    const target = pinnedPosts[safeIndex];
    if (!target) return;
    scrollToPost(target.id);
    const nextIndex =
      safeIndex + 1 >= pinnedPosts.length ? 0 : safeIndex + 1;
    setActivePinnedIndex(nextIndex);
  };

  const handleEditPost = (post: PostWithReactions) => {
    if (!post.content) return;
    setInputValue(post.content);
    setEditingPostId(post.id);
  };

  const handleCancelEdit = () => {
    setEditingPostId(null);
    setInputValue("");
  };

  const handleTogglePinPost = (post: PostWithReactions) => {
    const currentlyPinned = post.pinnedAt != null;
    // Optimistically toggle
    updatePost(
      { ...post, pinnedAt: currentlyPinned ? null : new Date() },
      { toTop: !currentlyPinned }
    );
    setShowPinnedBar(true);
    void togglePinPost(post.id, !currentlyPinned).catch(() => {
      // Rollback on failure
      updatePost(
        { ...post, pinnedAt: currentlyPinned ? new Date() : null },
        { toTop: currentlyPinned }
      );
    });
  };

  // When selectedFiles/editing changes, the footer height changes, so update offsets
  useEffect(() => {
    updateHeaderFooterOffsets();
  }, [selectedFiles.length, editingPostId, showPinnedBar]);

  return (
    <div
      ref={pageRef}
      style={{ height: `${pageHeight}px` }}
      className="flex flex-col-reverse overflow-y-scroll none-scroll-bar w-full outline-none max-w-2xl border-x border-secondary/5"
    >
      {/* Header */}
      <Header
        new_story={true}
        headerRef={headerRef}
        container_className="max-w-2xl"
      />

      {/* Pinned posts bar */}
      {showPinnedBar && pinnedPosts.length > 0 && (
        <div className="fixed top-[var(--chat-header-height)] left-1/2 -translate-x-1/2 w-full max-w-2xl z-40 px-4">
          <div
            ref={pinnedBarRef}
            onClick={handlePinnedBarClick}
            className="w-full backdrop-blur-md border border-secondary/5 cursor-pointer px-3 py-2 rounded-2xl bg-background/50"
          >
            <div className="flex items-center gap-x-2.5">
              <PinIcon className="size-5 stroke-[1.5px] rotate-45" />
              <div className="flex flex-col flex-1 text-xs">
                <span>
                  {t("general.pinned_post")}
                  {pinnedPosts.length > 1
                    ? ` — ${Math.min(
                        activePinnedIndex + 1,
                        pinnedPosts.length
                      )}/${pinnedPosts.length}`
                    : ""}
                </span>
                <span className="line-clamp-1 whitespace-pre-wrap wrap-break-word opacity-60">
                  {resolvePostPreview(
                    pinnedPosts[
                      Math.min(activePinnedIndex, pinnedPosts.length - 1)
                    ] ?? pinnedPosts[0]
                  )}
                </span>
              </div>
              <XIcon
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPinnedBar(false);
                }}
                className="size-3 stroke-[1.5px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* —— List —— */}
      <div className="flex-1 px-2.5 w-full">
        {/* Initial load */}
        {isLoading && posts.length === 0 && (
          <div className="w-full h-full flex justify-center items-center text-xl text-center">
            <Loader className="size-12 border border-primary/10 text-primary/50 p-2 rounded-full backdrop-blur-3xl bg-white/50" />
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="w-full h-full flex justify-center items-center text-xl text-center">
            {t.rich("general.wait_for_first_content", {
              owner_name: app_config[locale].name,
              highlight: (chunks) => (
                <span className="text-primary">&nbsp;{chunks}&nbsp;</span>
              ),
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center text-sm text-primary">
            Failed to load messages: {error}
          </div>
        )}

        {/* Posts */}
        <div
          ref={listRef}
          className="flex flex-col-reverse min-h-[var(--page-height)] pt-[calc(var(--chat-header-height)+var(--pinned-bar-height))] pb-[var(--chat-footer-height)]"
        >
          {posts.map((msg: PostWithReactions) => (
            <div
              key={msg.id}
              id={`message-${msg.id}`}
              data-message-id={msg.id}
              className={cn(
                "rounded-2xl",
                highlightedPostId === msg.id &&
                  "bg-primary/5 ring-2 ring-primary/40"
              )}
            >
              <Message
                can_pin_post
                can_edit_post
                can_delete_post
                post={msg}
                pinned={msg.pinnedAt != null}
                onDelete={removePost}
                onPin={handleTogglePinPost}
                onEdit={handleEditPost}
              />
            </div>
          ))}

          {/* Loading more (top infinite scroll) */}
          {isLoadingMore && posts.length > 0 && (
            <div className="grid place-items-center">
              <Loader />
            </div>
          )}

          {/* Sentinel for infinite scroll at visual TOP (DOM bottom because of flex-col-reverse) */}
          <div ref={sentinelRef} />
        </div>
      </div>

      {/* Footer */}
      <div ref={footerRef} className="fixed bottom-0 max-w-2xl w-full z-50">
        <div className="flex w-full gap-x-3 px-4 pb-3 lg:pb-5 justify-center items-center border-t border-x border-secondary/5 backdrop-blur-md bg-white/50">
          <div className="flex flex-col max-w-3xl w-full gap-y-2">
            {/* selected attachments preview */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-x-2">
                {selectedFiles.map((item, index) => {
                  const file = item.file;
                  const progress = item.progress;
                  const error = item.error;
                  const isImage = file.type.startsWith("image/");
                  const isVideo = file.type.startsWith("video/");
                  const isAudio = file.type.startsWith("audio/");
                  const sizeKB = Math.round(file.size / 1024);
                  const objectUrl = URL.createObjectURL(file);
                  const isUploadingFile = progress >= 0 && progress < 100;
                  const isUploaded = progress === 100 && !error;
                  const hasError = !!error;

                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className={`relative cursor-pointer flex items-center gap-2 rounded-xl border bg-primary/1 px-1 py-1 mt-2 text-xs text-primary ${
                        hasError ? 'border-red-500/50 bg-red-500/5' : 'border-primary/5'
                      }`}
                    >
                      {/* Thumbnail / icon */}
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-primary/5 bg-primary/3 flex items-center justify-center text-sm">
                        {isImage ? (
                          <img
                            src={objectUrl}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : isVideo ? (
                          <div className="relative w-full h-full">
                            {/* Simple video element used only to show a random-ish frame as poster substitute */}
                            <video
                              src={objectUrl}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={(e) => {
                                const video = e.currentTarget;
                                // Try to seek to ~1s to get a "random" thumbnail-like frame
                                try {
                                  if (video.duration > 2) {
                                    video.currentTime = 1;
                                  }
                                } catch {
                                  // ignore
                                }
                              }}
                              // do not autoplay / controls => acts as a thumbnail
                              controls={false}
                            />
                            <div className="pointer-events-none absolute inset-0 bg-black/10 flex items-center justify-center">
                              <span className="text-sm text-white rounded-full bg-black/20 border border-white/20 backdrop-blur-sm">
                                <PlayIcon className="p-1 stroke-1 size-6 opacity-50" />
                              </span>
                            </div>
                          </div>
                        ) : isAudio ? (
                          <span className="px-1 text-[11px]">AUD</span>
                        ) : (
                          <span className="px-1 text-[11px]">FILE</span>
                        )}

                        {/* Progress bar overlay */}
                        {isUploadingFile && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center">
                              <div 
                                className="w-6 h-6 rounded-full bg-white/80"
                                style={{
                                  clipPath: `polygon(0 0, ${progress}% 0, ${progress}% 100%, 0 100%)`
                                }}
                              />
                              <span className="absolute text-[8px] font-bold text-white">
                                {Math.round(progress)}%
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Error indicator */}
                        {hasError && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <span className="text-lg text-red-500">✕</span>
                          </div>
                        )}

                        {/* Success indicator */}
                        {isUploaded && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <span className="text-lg text-green-500">✓</span>
                          </div>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex flex-col max-w-[150px]">
                        <span className="truncate text-[11px] font-medium">
                          {file.name}
                        </span>
                        <span className={`text-[10px] ${hasError ? 'text-red-500' : 'opacity-60'}`}>
                          {hasError ? error : `${sizeKB} KB`}
                        </span>
                      </div>

                      {/* Remove button */}
                      <div
                        onClick={() => handleRemoveFile(index)}
                        className="cursor-pointer hover:opacity-60"
                      >
                        <XIcon className="size-3 stroke-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Editing post bar */}
            {activeEditPost && (
              <div className="w-full flex justify-center items-center tracking-tight px-4 pb-3 xl:px-0">
                <div className="w-full max-w-3xl backdrop-blur-md border border-secondary/5 cursor-pointer px-3 py-2 rounded-2xl bg-background/50">
                  <div className="flex items-center gap-x-2.5">
                    <div className="flex flex-col flex-1 text-xs">
                      <span>{t("general.editing_post")}</span>
                      <span className="line-clamp-1 whitespace-pre-wrap wrap-break-word opacity-60">
                        {resolvePostPreview(activeEditPost)}
                      </span>
                    </div>
                    <XIcon
                      onClick={handleCancelEdit}
                      className="size-3 stroke-[1.5px] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-x-2 w-full items-end">
              <div className="flex-1 sm:px-0 border-b border-secondary/5">
                <textarea
                  value={filterString(inputValue)}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.split("\n").length > MAX_LINES) return;
                    setInputValue(newValue);
                  }}
                  ref={inputRef}
                  placeholder={t("general.message_input_placeholder")}
                  autoComplete="off"
                  autoCorrect="off"
                  autoFocus={false}
                  rows={1}
                  maxLength={500}
                  className="text-start resize-none w-full flex py-2 pt-3 lg:pt-6 none-scroll-bar focus:outline-none active:outline-none overflow-y-hidden"
                />
              </div>

              {/* hidden input + clickable icon to open file picker */}
              <label className="relative">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,application/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <GalleryVerticalEndIcon className={`stroke-[1px] flex justify-center items-center opacity-80 w-10 h-10 mt-3 lg:mt-5 border border-secondary/3 p-2 rounded-full cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`} />
              </label>

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={(!inputValue.trim() && completedMedia.length === 0) || isUploading || hasError}
                className={cn(
                  "flex justify-center items-center w-10 h-10 mt-3 lg:mt-5 border border-secondary/3 p-2 rounded-full",
                  ((!inputValue.trim() && completedMedia.length === 0) || isUploading || hasError) && "opacity-60"
                )}
              >
                {isUploading ? (
                  <Loader className="size-5" />
                ) : (
                  <SendHorizonalIcon className="size-5 stroke-[1.5px] rtl:rotate-180 opacity-80" />
                )}
              </button>
            </div>
            <div className="line-clamp-2 md:line-clamp-1 text-sm tracking-tighter opacity-60">
              {t("general.lorem_ipsum")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;
