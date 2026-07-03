import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  databaseUrl: string | null
  description: string | null
  createdAt: string
  _count: {
    members: number
    contentTypeAssignments: number
    singleTypeAssignments: number
    componentAssignments: number
    media: number
    apiTokens: number
  }
  members: {
    role: string
    user: { id: string; name: string; email: string }
  }[]
  subscriptions: {
    id: string
    plan: string
    status: string
    currentPeriodEnd: string
  }[]
}

export function useAdminTenants() {
  const { toast } = useToast()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTenants, setTotalTenants] = useState(0)
  const [sort, setSort] = useState("createdAt:desc")

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants?page=${page}&limit=10&search=${encodeURIComponent(debouncedSearch)}&sort=${encodeURIComponent(sort)}`)
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || [])
        setTotalPages(data.totalPages || 1)
        setTotalTenants(data.total || 0)
      }
    } catch (error) {
      console.error("Failed to fetch tenants:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch tenants." })
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, sort, toast])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  return {
    tenants,
    loading,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    totalTenants,
    sort,
    setSort,
    refetch: fetchTenants
  }
}
