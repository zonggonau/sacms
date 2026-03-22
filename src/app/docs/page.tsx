"use client"

import Script from "next/script"

/**
 * API Documentation Page
 * Powered by Scalar (Modern alternative to Swagger UI)
 * Reads from /api/docs/openapi (which serves docs/openapi.yaml)
 */
export default function DocsPage() {
  return (
    <>
      <div
        id="api-reference"
        data-url="/api/docs/openapi"
      />
      <Script
        id="scalar-script"
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        strategy="afterInteractive"
      />
      <style dangerouslySetInnerHTML={{        __html: `
          body {
            margin: 0;
            padding: 0;
          }
          #api-reference {
            height: 100vh;
            width: 100vw;
          }
        `
      }} />
    </>
  )
}
