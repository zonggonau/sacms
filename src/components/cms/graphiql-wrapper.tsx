"use client"

import dynamic from "next/dynamic"

const GraphiQLInner = dynamic(() => import("./graphiql-inner"), { 
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center">Loading Playground...</div>
})

interface GraphiQLWrapperProps {
  endpoint: string
  headers?: Record<string, string>
}

export function GraphiQLWrapper({ endpoint, headers }: GraphiQLWrapperProps) {
  return <GraphiQLInner endpoint={endpoint} headers={headers} />
}
