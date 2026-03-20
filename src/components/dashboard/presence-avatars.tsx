"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PresenceUser {
  id: string
  username: string
  image?: string | null
}

interface PresenceAvatarsProps {
  users: PresenceUser[]
}

export function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null

  // Show max 3 avatars, then a "+N" count
  const displayUsers = users.slice(0, 3)
  const remainingCount = users.length - displayUsers.length

  return (
    <TooltipProvider>
      <div className="flex -space-x-2 overflow-hidden items-center">
        {displayUsers.map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <Avatar className="inline-block border-2 border-background h-8 w-8">
                <AvatarImage src={user.image || ""} alt={user.username} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px]">
                  {user.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{user.username}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-background bg-muted text-[10px] font-medium">
            +{remainingCount}
          </div>
        )}
        <span className="ml-2 text-[10px] text-muted-foreground font-medium animate-pulse">
          Editing now
        </span>
      </div>
    </TooltipProvider>
  )
}
