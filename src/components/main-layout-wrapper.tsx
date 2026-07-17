'use client';

import React from 'react';

export default function MainLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="w-full flex justify-center"
    >
      {children}
    </div>
  );
}