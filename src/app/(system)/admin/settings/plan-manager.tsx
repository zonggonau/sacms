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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, X, PlusCircle } from "lucide-react"

export interface PlanItem {
  id: string
  name: string
  price: number
  is_popular: boolean
  features: string[]
}

interface PlanManagerProps {
  title: string
  description: string
  plansString: string
  onChange: (plansString: string) => void
}

export function PlanManager({ title, description, plansString, onChange }: PlanManagerProps) {
  let initialPlans: PlanItem[] = []
  try {
    initialPlans = JSON.parse(plansString || "[]")
    if (!Array.isArray(initialPlans)) initialPlans = []
  } catch {
    initialPlans = []
  }

  const [plans, setPlans] = useState<PlanItem[]>(initialPlans)
  const [isOpen, setIsOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null)

  // Form State
  const [name, setName] = useState("")
  const [price, setPrice] = useState<number>(0)
  const [isPopular, setIsPopular] = useState(false)
  const [features, setFeatures] = useState<string[]>([])
  const [newFeature, setNewFeature] = useState("")

  const openNew = () => {
    setEditingPlan(null)
    setName("")
    setPrice(0)
    setIsPopular(false)
    setFeatures([])
    setNewFeature("")
    setIsOpen(true)
  }

  const openEdit = (plan: PlanItem) => {
    setEditingPlan(plan)
    setName(plan.name)
    setPrice(plan.price)
    setIsPopular(plan.is_popular)
    setFeatures([...plan.features])
    setNewFeature("")
    setIsOpen(true)
  }

  const handleDelete = (id: string) => {
    const newPlans = plans.filter(p => p.id !== id)
    updatePlans(newPlans)
  }

  const handleSave = () => {
    if (!name.trim()) return

    const newPlanData: PlanItem = {
      id: editingPlan ? editingPlan.id : Math.random().toString(36).substring(7),
      name,
      price,
      is_popular: isPopular,
      features
    }

    let newPlans: PlanItem[]
    if (editingPlan) {
      newPlans = plans.map(p => p.id === editingPlan.id ? newPlanData : p)
    } else {
      newPlans = [...plans, newPlanData]
    }

    updatePlans(newPlans)
    setIsOpen(false)
  }

  const updatePlans = (newPlans: PlanItem[]) => {
    setPlans(newPlans)
    onChange(JSON.stringify(newPlans, null, 2))
  }

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()])
      setNewFeature("")
    }
  }

  const removeFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openNew} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Plan
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Plan Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Popular</TableHead>
              <TableHead>Features</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No plans configured yet.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(plan.price)}
                  </TableCell>
                  <TableCell>
                    {plan.is_popular ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-none shadow-none text-xs">Yes</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{plan.features.length} features</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
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
        <DialogContent className="max-w-md rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Add New Plan"}</DialogTitle>
            <DialogDescription>
              Configure the pricing and features for this plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starter, Pro, Enterprise" />
            </div>
            
            <div className="space-y-2">
              <Label>Price (IDR)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-xl bg-muted/20">
              <div className="space-y-0.5">
                <Label>Most Popular</Label>
                <p className="text-[10px] text-muted-foreground">Highlight this plan on the pricing page</p>
              </div>
              <Switch checked={isPopular} onCheckedChange={setIsPopular} />
            </div>

            <div className="space-y-2">
              <Label>Features ({features.length})</Label>
              <div className="flex gap-2">
                <Input 
                  value={newFeature} 
                  onChange={(e) => setNewFeature(e.target.value)} 
                  placeholder="e.g. 5 Workspaces"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                />
                <Button type="button" onClick={addFeature} variant="secondary"><PlusCircle className="h-4 w-4" /></Button>
              </div>
              
              {features.length > 0 && (
                <div className="flex flex-col gap-2 mt-2 max-h-[150px] overflow-y-auto p-2 border rounded-xl bg-muted/10">
                  {features.map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-card border px-3 py-1.5 rounded-lg text-sm">
                      <span>{feat}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFeature(idx)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary">Save Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
