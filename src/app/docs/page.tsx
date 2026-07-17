"use client";

import { useEffect, useState } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";

import "@scalar/api-reference-react/style.css";

export default function ApiDocsPage() {
  const [baseServerURL, setBaseServerURL] = useState("");

  useEffect(() => {
    setBaseServerURL(window.location.origin);
  }, []);

  return (
    <ApiReferenceReact
      configuration={{
        url: "/openapi.json",
        theme: "mars",
        defaultOpenAllTags: true,
        expandAllResponses: true,
        hideSearch: true,
        hideModels: true,
        hideDarkModeToggle: true,
        darkMode: false,
        hideDownloadButton: true,
        showDeveloperTools: "never",
        searchHotKey: "s",
        persistAuth: true,
        mcp: {
          disabled: false,
        },
        hideClientButton: true,
        pathRouting: {
          basePath: "/docs",
        },
        baseServerURL: baseServerURL,
        metaData: {
          //
        },
      }}
    />
  );
}
