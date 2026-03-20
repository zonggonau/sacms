"use client"

import Head from "next/head"

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
      <script
        id="scalar-script"
        dangerouslySetInnerHTML={{
          __html: `
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
            script.onload = () => {
              // The reference will auto-render on the element with id="api-reference"
            };
            document.head.appendChild(script);
          `,
        }}
      />
      <style dangerouslySetInnerHTML={{
        __html: `
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
