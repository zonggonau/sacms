import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

export async function GET(req: any, res: any) {
  return await handler(req, res)
}

export async function POST(req: any, res: any) {
  return await handler(req, res)
}
