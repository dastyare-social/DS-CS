import { capitalize } from "@/lib/utils";
import { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import React from "react";
import { app_config, app_url } from "@/config/app";
import { Locale } from "@/config/locale";
import { getPostById } from "@/lib/api/posts/queries";
import { ArticleSchema } from "@/components/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ post_id: string }>;
}): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { post_id } = await params;

  let description = app_config[locale].desc;
  let pageTitle = capitalize(t("general.message"));

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

  return {
    metadataBase: new URL(app_url),
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: `${app_url}/posts/${post_id}`,
      siteName: t("general.app_name", { owner_name: app_config[locale].name }),
      locale,
      type: "article",
      images: [
        {
          url: `${app_url}/api/og/posts/${post_id}`,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [`${app_url}/api/og/posts/${post_id}`],
    },
    alternates: {
      canonical: `${app_url}/posts/${post_id}`,
    },
  };
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

  let videoData: any = null;
  let imageData: any = null;

  if (post?.media) {
    const media = post.media as any;
    if (post.type === "video" && media.url) {
      videoData = {
        url: media.url,
        name: post.content?.substring(0, 60) || "Video",
        description: post.content || undefined,
        thumbnailUrl: media.thumbnail || undefined,
        uploadDate: post.createdAt?.toISOString(),
        duration: media.duration ? `PT${media.duration}S` : undefined,
        width: media.width,
        height: media.height,
      };
    }
    if (post.type === "image" && media.url) {
      imageData = {
        url: media.url,
        width: media.width,
        height: media.height,
        caption: media.caption || post.content?.substring(0, 100),
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
