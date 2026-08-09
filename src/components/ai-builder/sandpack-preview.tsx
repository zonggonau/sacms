"use client"

import { Sandpack } from "@codesandbox/sandpack-react"
import { useTheme } from "next-themes"

interface SandpackPreviewProps {
  code: string
}

export function SandpackPreview({ code }: SandpackPreviewProps) {
  const { theme } = useTheme()

  return (
    <div className="h-full w-full overflow-hidden border border-border rounded-lg">
      <Sandpack
        template="react-ts"
        theme={theme === "dark" ? "dark" : "light"}
        files={{
          "/App.tsx": code,
          "/index.tsx": `
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
          `,
          "/styles.css": `
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
          `,
          "/tailwind.config.js": `
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
          `
        }}
        customSetup={{
          dependencies: {
            "lucide-react": "latest",
            "date-fns": "latest",
          }
        }}
        options={{
          showNavigator: true,
          showTabs: true,
          showLineNumbers: false,
          editorHeight: "100%",
          externalResources: [
            "https://cdn.tailwindcss.com"
          ]
        }}
      />
    </div>
  )
}
