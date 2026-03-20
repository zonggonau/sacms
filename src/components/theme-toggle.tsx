"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="hidden md:flex"
    >
      <span className="sr-only">Toggle theme</span>
      {mounted ? (
        theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
      ) : (
        <div className="w-5 h-5" />
      )}
    </Button>
  )
}
