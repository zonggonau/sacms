import { Tenant } from "@/hooks/admin/use-admin-tenants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Ban, CheckCircle, Database, Edit, FileText, ImageIcon, Key, MoreVertical, Shield, Sliders, Trash2, Users } from "lucide-react"

interface TenantTableProps {
  tenants: Tenant[]
  loading: boolean
  onEdit: (tenant: Tenant) => void
  onDelete: (tenant: Tenant) => void
  onOverride: (tenant: Tenant) => void
  onStatusChange: (id: string, status: string) => void
}

export function TenantTable({ tenants, loading, onEdit, onDelete, onOverride, onStatusChange }: TenantTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border rounded-md border-dashed">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <Database className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">No tenants found</h3>
        <p className="text-muted-foreground mt-1">Adjust your search or create a new tenant.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workspace</TableHead>
            <TableHead>Status & Plan</TableHead>
            <TableHead>Usage Stats</TableHead>
            <TableHead className="hidden md:table-cell">Members</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="font-bold text-primary">{tenant.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      {tenant.slug}
                    </div>
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex flex-col gap-2 items-start">
                  <Badge variant={tenant.status === "active" ? "default" : tenant.status === "suspended" ? "destructive" : "secondary"}>
                    {tenant.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {tenant.plan}
                  </Badge>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground max-w-[200px]">
                  <div className="flex items-center gap-1" title="Content Types">
                    <Database className="h-3 w-3" /> {tenant._count.contentTypeAssignments + tenant._count.componentAssignments}
                  </div>
                  <div className="flex items-center gap-1" title="Entries">
                    <FileText className="h-3 w-3" /> {tenant._count.singleTypeAssignments}
                  </div>
                  <div className="flex items-center gap-1" title="Media Files">
                    <ImageIcon className="h-3 w-3" /> {tenant._count.media}
                  </div>
                  <div className="flex items-center gap-1" title="API Tokens">
                    <Key className="h-3 w-3" /> {tenant._count.apiTokens}
                  </div>
                </div>
              </TableCell>
              
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{tenant._count.members}</span>
                </div>
              </TableCell>
              
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => window.open(`/dashboard/${tenant.slug}`, "_blank")}>
                      <Shield className="h-4 w-4 mr-2" /> Open Dashboard
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={() => onEdit(tenant)}>
                      <Edit className="h-4 w-4 mr-2" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onOverride(tenant)}>
                      <Sliders className="h-4 w-4 mr-2" /> Override Limits
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {tenant.status === "active" ? (
                      <DropdownMenuItem onClick={() => onStatusChange(tenant.id, "suspended")} className="text-orange-600">
                        <Ban className="h-4 w-4 mr-2" /> Suspend
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onStatusChange(tenant.id, "active")} className="text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" /> Activate
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem onClick={() => onDelete(tenant)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
