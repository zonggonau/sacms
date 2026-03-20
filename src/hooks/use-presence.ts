"use client"

import { useEffect, useState, useRef } from "react"
import { io, Socket } from "socket.io-client"
import { useSession } from "next-auth/react"

interface PresenceUser {
  id: string
  username: string
  image?: string | null
}

/**
 * usePresence Hook
 * Tracks real-time presence of users in a specific "room" (e.g., a content entry).
 */
export function usePresence(roomName: string) {
  const { data: session } = useSession()
  const [users, setUsers] = useState<PresenceUser[]>([])
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!session?.user || !roomName) return

    // Connect to the WebSocket server (using the port from example/websocket/server.ts)
    // In production, this would typically be the same host or a configured URL
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3003"
    const socket = io(socketUrl)
    socketRef.current = socket

    socket.on("connect", () => {
      console.log("Connected to Presence Server")
      // Join the specific room
      socket.emit("join", { 
        username: session.user.name || session.user.email,
        room: roomName 
      })
    })

    socket.on("users-list", (data: { users: PresenceUser[] }) => {
      setUsers(data.users)
    })

    socket.on("user-joined", (data: { user: PresenceUser }) => {
      setUsers((prev) => {
        if (prev.some(u => u.id === data.user.id)) return prev
        return [...prev, data.user]
      })
    })

    socket.on("user-left", (data: { user: { id: string } }) => {
      setUsers((prev) => prev.filter(u => u.id !== data.user.id))
    })

    return () => {
      socket.disconnect()
    }
  }, [session, roomName])

  return { users }
}
