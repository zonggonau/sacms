"use client"

import { useState } from "react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"

export interface BlogItem {
  title: string
  excerpt: string
  date: string
  author: string
  image_url: string
  slug: string
}

interface BlogManagerProps {
  landingDataString: string
  onChange: (newDataString: string) => void
}

export function BlogManager({ landingDataString, onChange }: BlogManagerProps) {
  let landingData: any = {}
  let initialBlogs: BlogItem[] = []
  
  try {
    landingData = JSON.parse(landingDataString || "{}")
    initialBlogs = landingData["sacms-blogs"] || []
    if (!Array.isArray(initialBlogs)) initialBlogs = []
  } catch {
    initialBlogs = []
  }

  const [blogs, setBlogs] = useState<BlogItem[]>(initialBlogs)
  const [isOpen, setIsOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Form State
  const [title, setTitle] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [date, setDate] = useState("")
  const [author, setAuthor] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [slug, setSlug] = useState("")

  const openNew = () => {
    setEditingIndex(null)
    setTitle("")
    setExcerpt("")
    setDate(new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }))
    setAuthor("")
    setImageUrl("")
    setSlug("")
    setIsOpen(true)
  }

  const openEdit = (blog: BlogItem, index: number) => {
    setEditingIndex(index)
    setTitle(blog.title || "")
    setExcerpt(blog.excerpt || "")
    setDate(blog.date || "")
    setAuthor(blog.author || "")
    setImageUrl(blog.image_url || "")
    setSlug(blog.slug || "")
    setIsOpen(true)
  }

  const handleDelete = (index: number) => {
    const newBlogs = [...blogs]
    newBlogs.splice(index, 1)
    updateBlogs(newBlogs)
  }

  const handleSave = () => {
    if (!title.trim() || !slug.trim()) return

    const newBlogData: BlogItem = {
      title,
      excerpt,
      date,
      author,
      image_url: imageUrl,
      slug
    }

    const newBlogs = [...blogs]
    if (editingIndex !== null) {
      newBlogs[editingIndex] = newBlogData
    } else {
      newBlogs.unshift(newBlogData) // Add new blogs to the top
    }

    updateBlogs(newBlogs)
    setIsOpen(false)
  }

  const updateBlogs = (newBlogs: BlogItem[]) => {
    setBlogs(newBlogs)
    
    // Update the full landing data string
    try {
      const currentData = JSON.parse(landingDataString || "{}")
      currentData["sacms-blogs"] = newBlogs
      onChange(JSON.stringify(currentData, null, 2))
    } catch (e) {
      console.error("Failed to update landing data string")
    }
  }

  // Auto-generate slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (editingIndex === null) { // Only auto-generate if creating new
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generatedSlug)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Blog Manager</h2>
          <p className="text-sm text-muted-foreground">Manage blog posts for the landing page.</p>
        </div>
        <Button onClick={openNew} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Blog
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No blog posts found.
                </TableCell>
              </TableRow>
            ) : (
              blogs.map((blog, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {blog.image_url ? (
                        <img src={blog.image_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs">No img</div>
                      )}
                      <div>
                        <p className="line-clamp-1">{blog.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{blog.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{blog.author || "-"}</TableCell>
                  <TableCell>{blog.date || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(blog, idx)}>
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-none shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Edit Blog Post" : "Add New Blog Post"}</DialogTitle>
            <DialogDescription>
              Configure the blog post details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Blog title" />
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="url-friendly-slug" />
              </div>

              <div className="space-y-2">
                <Label>Author</Label>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="e.g. 12 Agu 2026" />
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Image URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                {imageUrl && (
                  <img src={imageUrl} alt="Preview" className="h-32 rounded-lg object-cover mt-2 border" />
                )}
              </div>

              <div className="space-y-2 col-span-2">
                <Label>Excerpt</Label>
                <Textarea 
                  value={excerpt} 
                  onChange={(e) => setExcerpt(e.target.value)} 
                  placeholder="Short description for the blog card..." 
                  className="h-24"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary">Save Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
