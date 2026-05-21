import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import type { NextRequest } from "next/server"

async function auth(req: NextRequest, ctx: any) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3001"
  const proto = req.headers.get("x-forwarded-proto") || "http"
  
  process.env.NEXTAUTH_URL = `${proto}://${host}`
  
  // Re-instantiate NextAuth handler dynamically to ensure it picks up the overridden NEXTAUTH_URL
  return NextAuth(authOptions)(req, ctx)
}

export { auth as GET, auth as POST }
