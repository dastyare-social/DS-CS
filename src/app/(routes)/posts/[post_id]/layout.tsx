import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import React from "react";
import { app_config, app_url } from "@/config/app";
import { Locale } from "@/config/locale";
import { getPostById } from "@/lib/api/posts/queries";
import { ArticleSchema } from "@/components/seo";
import { postMetadata } from "../../../../../config/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ post_id: string }>;
}): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const { post_id } = await params;

  let pageTitle = "Message";
  let description = app_config[locale].desc;

  try {
    const post = await getPostById(post_id);
    if (post?.content) {
      description = post.content.length > 200
        ? post.content.substring(0, 200) + "..."
        : post.content;
      pageTitle = post.content.length > 60
        ? post.content.substring(0, 60) + "..."
        : post.content;
    }
  } catch (e) {
    console.error("Error fetching post for metadata:", e);
  }

  return postMetadata(locale, { post_id, pageTitle, description });
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ post_id: string }>;
}) {
  const locale = (await getLocale()) as Locale;
  const { post_id } = await params;
  const post = await getPostById(post_id);

  let videoData: {
    url: string;
    name: string;
    description?: string;
    thumbnailUrl?: string;
    uploadDate?: string;
    duration?: string;
    width?: number;
    height?: number;
  } | undefined;
  let imageData: {
    url: string;
    width?: number;
    height?: number;
    caption?: string;
  } | null = null;

  if (post?.media) {
    const media = post.media;
    if (post.type === "video" && media.url) {
      videoData = {
        url: media.url,
        name: post.content?.substring(0, 60) || "Video",
        description: post.content || undefined,
        thumbnailUrl: "thumbnail" in media ? media.thumbnail || undefined : undefined,
        uploadDate: post.createdAt?.toISOString(),
        duration: "duration" in media && media.duration ? `PT${media.duration}S` : undefined,
        width: "width" in media ? media.width : undefined,
        height: "height" in media ? media.height : undefined,
      };
    }
    if (post.type === "image" && media.url) {
      imageData = {
        url: media.url,
        width: "width" in media ? media.width : undefined,
        height: "height" in media ? media.height : undefined,
        caption: ("caption" in media ? media.caption : undefined) || post.content?.substring(0, 100),
      };
    }
  }

  return (
    <>
      {post && (
        <ArticleSchema
          headline={post.content?.substring(0, 110) || "Post"}
          description={post.content?.substring(0, 200) || app_config[locale].desc}
          datePublished={post.createdAt?.toISOString() || new Date().toISOString()}
          dateModified={post.updatedAt?.toISOString() || post.createdAt?.toISOString() || new Date().toISOString()}
          author={{
            name: app_config[locale].name,
            url: app_url,
          }}
          url={`${app_url}/posts/${post_id}`}
          image={imageData?.url}
          video={videoData}
        />
      )}
      {children}
    </>
  );
}
