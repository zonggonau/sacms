"use client"

import { useState, KeyboardEvent } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X, Hash } from "lucide-react"
import { cn } from "@/lib/utils"

interface TagsFieldProps {
  value: string[] | string | null
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
}

export function TagsField({
  value,
  onChange,
  placeholder = "Type and press Enter...",
  className
}: TagsFieldProps) {
  const [inputValue, setInputValues] = useState("")
  
  // Ensure value is always an array
  const tags = Array.isArray(value) 
    ? value 
    : (typeof value === 'string' && value.trim() !== "" ? value.split(",").map(t => t.trim()) : [])

  const addTag = () => {
    const trimmedValue = inputValue.trim().replace(/^#/, "")
    if (trimmedValue && !tags.includes(trimmedValue)) {
      const newTags = [...tags, trimmedValue]
      onChange(newTags)
      setInputValues("")
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    onChange(newTags)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Hash className="h-4 w-4" />
        </div>
        <Input
          value={inputValue}
          onChange={(e) => setInputValues(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : "Add more..."}
          className="pl-9 h-11 rounded-none bg-muted/30 border-none focus-visible:ring-primary/20 font-medium"
        />
      </div>
      
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
          {tags.map((tag, index) => (
            <Badge 
              key={`${tag}-${index}`}
              variant="secondary"
              className="pl-2 pr-1 py-1 h-7 rounded-none bg-primary/10 text-primary hover:bg-primary/20 border-none flex items-center gap-1 group transition-all"
            >
              <span className="text-[11px] font-bold">#{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="rounded-none p-0.5 hover:bg-primary/20 text-primary/50 hover:text-primary transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      <p className="text-[10px] text-muted-foreground italic ml-1">
        Press <span className="font-bold bg-muted px-1 rounded-none text-foreground">Enter</span> or <span className="font-bold bg-muted px-1 rounded-none text-foreground">Comma</span> to add tags.
      </p>
    </div>
  )
}
