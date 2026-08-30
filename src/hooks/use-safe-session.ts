"use client"

import { useSession } from "next-auth/react"

export function useSafeSession() {
  try {
    return useSession()
  } catch {
    return { 
      data: null, 
      status: "unauthenticated" as const, 
      update: async () => null 
    }
  }
}
