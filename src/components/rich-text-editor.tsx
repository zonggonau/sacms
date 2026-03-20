"use client"

import dynamic from "next/dynamic"
import "react-quill-new/dist/quill.snow.css"

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false })

const fullModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["link", "image"],
    ["blockquote", "code-block"],
    ["clean"],
  ],
}

const simpleModules = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
}

const fullFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "align",
  "link",
  "image",
  "blockquote",
  "code-block",
]

const simpleFormats = [
  "bold",
  "italic",
  "underline",
  "list",
  "link",
]

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  simple?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Mulai menulis...",
  minHeight = 260,
  simple = false,
}: RichTextEditorProps) {
  return (
    <div className="bg-background">
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        modules={simple ? simpleModules : fullModules}
        formats={simple ? simpleFormats : fullFormats}
      />
      <style jsx global>{`
        .ql-container {
          min-height: ${minHeight}px;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
