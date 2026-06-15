"use client"

import { useState, useTransition } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save, User as UserIcon, Mail, Shield, Key } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateProfileAction } from "@/actions/profile"

interface UserProfileProps {
  initialData?: {
    name: string
    email: string
    role: string
  }
}

export function UserProfile({ initialData }: UserProfileProps) {
  const { update } = useSession()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(initialData?.name || "")
  const [email, setEmail] = useState(initialData?.email || "")
  const [role, setRole] = useState(initialData?.role || "user")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password && password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      })
      return
    }

    startTransition(async () => {
      try {
        const result = await updateProfileAction({
          name,
          password: password || undefined
        })

        if (result.success) {
          await update({ name: result.user?.name }) // Update NextAuth session
          setPassword("")
          setConfirmPassword("")
          toast({
            title: "Profile Updated",
            description: "Your profile has been successfully updated.",
          })
        } else {
          toast({
            title: "Update Failed",
            description: result.error || "Failed to update profile.",
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "Update Failed",
          description: "An unexpected error occurred.",
          variant: "destructive"
        })
      } finally {
        setSaving(false)
      }
    })
  }



  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your personal information and security settings.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4">
                  {name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <h3 className="text-xl font-bold">{name}</h3>
                <p className="text-sm text-muted-foreground">{email}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold capitalize">
                  <Shield className="h-3.5 w-3.5" />
                  {role}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your basic profile details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-muted-foreground" /> Full Name
                  </Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Enter your name" 
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
                  </Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    disabled 
                    className="bg-muted/50 text-muted-foreground" 
                  />
                  <p className="text-xs text-muted-foreground">Email addresses cannot be changed currently.</p>
                </div>

                <div className="pt-4 mt-4 border-t">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Key className="h-4 w-4 text-muted-foreground" /> Change Password
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input 
                        id="new-password" 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Leave blank to keep current" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input 
                        id="confirm-password" 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Confirm new password" 
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 flex justify-end border-t p-4">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </div>
    </div>
  )
}
