"use client"

import { useState, useEffect } from "react"
import { Check, Loader2, UserPlus, X, Shield, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"

interface Member {
  id: string
  userId: string
  role: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface Reviewer {
  reviewerId: string
  reviewerName: string | null
  status: string
  order: number
}

interface ReviewerAssignmentProps {
  tenantSlug: string
  entryId: string
}

export function ReviewerAssignment({ tenantSlug, entryId }: ReviewerAssignmentProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [reviewers, setReviewers] = useState<Reviewer[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, reviewersRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/members`),
          fetch(`/api/tenant/${tenantSlug}/workflow/reviewers?entryId=${entryId}`)
        ])

        if (membersRes.ok) {
          const data = await membersRes.json()
          setMembers(data.members || [])
        }
        if (reviewersRes.ok) {
          const data = await reviewersRes.json()
          setReviewers(data.reviewers || [])
        }
      } catch (err) {
        console.error("Failed to load workflow data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [tenantSlug, entryId])

  const handleAddReviewer = async (member: Member) => {
    if (reviewers.some(r => r.reviewerId === member.userId)) {
      toast({ title: "Already added", description: "This user is already a reviewer." })
      return
    }

    setSaving(true)
    try {
      const newReviewer: Reviewer = {
        reviewerId: member.userId,
        reviewerName: member.user.name || member.user.email,
        status: "pending",
        order: reviewers.length
      }
      
      const updatedReviewers = [...reviewers, newReviewer]
      
      const res = await fetch(`/api/tenant/${tenantSlug}/workflow/reviewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, reviewers: updatedReviewers.map(r => ({ userId: r.reviewerId, name: r.reviewerName })) })
      })

      if (res.ok) {
        setReviewers(updatedReviewers)
        toast({ title: "Reviewer added" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to add reviewer" })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveReviewer = async (reviewerId: string) => {
    setSaving(true)
    try {
      const updatedReviewers = reviewers.filter(r => r.reviewerId !== reviewerId)
        .map((r, idx) => ({ ...r, order: idx }))

      const res = await fetch(`/api/tenant/${tenantSlug}/workflow/reviewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, reviewers: updatedReviewers.map(r => ({ userId: r.reviewerId, name: r.reviewerName })) })
      })

      if (res.ok) {
        setReviewers(updatedReviewers)
        toast({ title: "Reviewer removed" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to remove reviewer" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>

  return (
    <Card className="border border-border shadow-none bg-card rounded-none overflow-hidden">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-orange-500" /> Review Workflow
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none hover:bg-muted" disabled={saving}>
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-none border border-border bg-card shadow-none">
              {members.filter(m => m.role !== 'viewer').map(m => (
                <DropdownMenuItem key={m.id} onClick={() => handleAddReviewer(m)} className="text-xs font-bold rounded-none hover:bg-muted">
                  {m.user.name || m.user.email}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {reviewers.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">No reviewers assigned. direct approval enabled.</p>
        ) : (
          <div className="space-y-2">
            {reviewers.sort((a, b) => a.order - b.order).map((r, idx) => (
              <div key={r.reviewerId} className="flex items-center justify-between gap-2 p-2 bg-muted/30 border border-border group">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center text-[10px] font-black text-orange-600 border border-orange-500/20">
                    {idx + 1}
                  </div>
                  <span className="text-[11px] font-bold truncate">{r.reviewerName}</span>
                </div>
                <div className="flex items-center gap-1">
                  {r.status === 'approved' ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : r.status === 'rejected' ? (
                    <X className="h-3 w-3 text-red-500" />
                  ) : (
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 rounded-none opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                    onClick={() => handleRemoveReviewer(r.reviewerId)}
                    disabled={saving}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
