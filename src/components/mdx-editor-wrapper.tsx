"use client"

import { MDXEditor } from "@mdxeditor/editor"

export function MDXEditorWrapper({
  value,
  onChange,
  placeholder,
  contentEditableClassName,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  contentEditableClassName?: string
}) {
  return (
    <MDXEditor
      markdown={value || ""}
      onChange={onChange}
      placeholder={placeholder || "Enter content..."}
      contentEditableClassName={contentEditableClassName || "prose max-w-none"}
    />
  )
}
