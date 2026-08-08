"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PasswordFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
}

export function PasswordField({ value, onChange, required, placeholder = "Masukkan kata sandi..." }: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false)

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    let pass = ""
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    onChange(pass)
    setShowPassword(true) // Show the generated password so the user can copy it
  }

  return (
    <div className="flex w-full items-center space-x-2 relative group">
      <div className="relative flex-1">
        <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type={showPassword ? "text" : "password"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="pl-9 pr-10 font-mono tracking-wider"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="sr-only">{showPassword ? "Sembunyikan" : "Tampilkan"} password</span>
        </Button>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              type="button" 
              variant="outline" 
              size="icon" 
              onClick={generatePassword}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Generate password acak</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
