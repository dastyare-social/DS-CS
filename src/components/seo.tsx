import React from 'react';

interface PersonSchemaProps {
  name: string;
  url: string;
  image?: string;
  email?: string;
}

export function PersonSchema({ name, url, image, email }: PersonSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url,
    ...(image && { image }),
    ...(email && { email }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ArticleSchemaProps {
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  author: {
    name: string;
    url: string;
  };
  url: string;
  image?: string;
  video?: {
    url: string;
    name: string;
    description?: string;
    thumbnailUrl?: string;
    uploadDate?: string;
    duration?: string;
    width?: number;
    height?: number;
  };
}

export function ArticleSchema({
  headline,
  description,
  datePublished,
  dateModified,
  author,
  url,
  image,
  video,
}: ArticleSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    datePublished,
    dateModified,
    author: {
      '@type': 'Person',
      name: author.name,
      url: author.url,
    },
    publisher: {
      '@type': 'Person',
      name: author.name,
      url: author.url,
    },
    url,
    ...(image && { image }),
    ...(video && {
      video: {
        '@type': 'VideoObject',
        ...video,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ImageObjectSchemaProps {
  url: string;
  width?: number;
  height?: number;
  caption?: string;
}

export function ImageObjectSchema({
  url,
  width,
  height,
  caption,
}: ImageObjectSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    url,
    ...(width && { width }),
    ...(height && { height }),
    ...(caption && { caption }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface CollectionPageSchemaProps {
  name: string;
  description: string;
  url: string;
  author: {
    name: string;
    url: string;
  };
}

export function CollectionPageSchema({
  name,
  description,
  url,
  author,
}: CollectionPageSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url,
    author: {
      '@type': 'Person',
      name: author.name,
      url: author.url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
