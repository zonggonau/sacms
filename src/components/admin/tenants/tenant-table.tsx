import { Tenant } from "@/hooks/admin/use-admin-tenants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
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
import { SYSTEM_TENANT_SLUG } from "@/lib/constants"
import { cn } from "@/lib/utils"

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
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center h-64 border border-dashed border-border/80 rounded-2xl bg-card">
        <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3 border border-border/60">
          <Database className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Tidak Ada Workspace</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Sesuaikan pencarian atau tambahkan workspace baru.</p>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="border-b border-border/60">
            <TableHead className="font-bold text-xs uppercase pl-5">Workspace</TableHead>
            <TableHead className="font-bold text-xs uppercase">Status & Paket</TableHead>
            <TableHead className="font-bold text-xs uppercase">Statistik Entitas</TableHead>
            <TableHead className="hidden md:table-cell font-bold text-xs uppercase">Anggota</TableHead>
            <TableHead className="text-right font-bold text-xs uppercase pr-5">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((tenant) => {
            const isGlobal = tenant.slug === SYSTEM_TENANT_SLUG || tenant.slug === "sacms" || tenant.id === "sacms-global" || tenant.name.toLowerCase() === "sacms global"
            return (
            <TableRow key={tenant.id} className="hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0">
              <TableCell className="pl-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="font-black text-xs text-primary">{tenant.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-foreground">{tenant.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      /{tenant.slug}
                    </div>
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="flex flex-col gap-1 items-start">
                  <Badge className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-none",
                    tenant.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                    tenant.status === "suspended" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" :
                    "bg-muted text-muted-foreground border-border/60"
                  )}>
                    {tenant.status === "active" ? "Aktif" : tenant.status === "suspended" ? "Ditangguhkan" : tenant.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize text-[9px] font-bold rounded-full border-border/60 text-muted-foreground">
                    {tenant.plan}
                  </Badge>
                </div>
              </TableCell>
              
              <TableCell>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground max-w-[200px] font-mono">
                  <div className="flex items-center gap-1" title="Content Types">
                    <Database className="h-3 w-3 text-primary" /> {tenant._count.contentTypeAssignments + tenant._count.componentAssignments} Tipe
                  </div>
                  <div className="flex items-center gap-1" title="Entries">
                    <FileText className="h-3 w-3 text-primary" /> {tenant._count.singleTypeAssignments} Statis
                  </div>
                  <div className="flex items-center gap-1" title="Media Files">
                    <ImageIcon className="h-3 w-3 text-primary" /> {tenant._count.media} Media
                  </div>
                  <div className="flex items-center gap-1" title="API Tokens">
                    <Key className="h-3 w-3 text-primary" /> {tenant._count.apiTokens} API
                  </div>
                </div>
              </TableCell>
              
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-1.5 text-xs text-foreground font-bold">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{tenant._count.members}</span>
                </div>
              </TableCell>
              
              <TableCell className="text-right pr-5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-xl border-border bg-card">
                    <DropdownMenuItem onClick={() => window.open(`/dashboard/${tenant.slug}`, "_blank")} className="cursor-pointer text-xs rounded-lg">
                      <Shield className="h-3.5 w-3.5 mr-2 text-primary" /> Buka Dashboard
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={() => onEdit(tenant)} className="cursor-pointer text-xs rounded-lg">
                      <Edit className="h-3.5 w-3.5 mr-2" /> Ubah Rincian
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onOverride(tenant)} className="cursor-pointer text-xs rounded-lg">
                      <Sliders className="h-3.5 w-3.5 mr-2" /> Kustomisasi Kuota
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {tenant.status === "active" ? (
                      <DropdownMenuItem onClick={() => onStatusChange(tenant.id, "suspended")} className="text-amber-600 focus:text-amber-600 cursor-pointer text-xs rounded-lg">
                        <Ban className="h-3.5 w-3.5 mr-2" /> Tangguhkan Workspace
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => onStatusChange(tenant.id, "active")} className="text-emerald-600 focus:text-emerald-600 cursor-pointer text-xs rounded-lg">
                        <CheckCircle className="h-3.5 w-3.5 mr-2" /> Aktifkan Workspace
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuItem 
                      onClick={() => !isGlobal && onDelete(tenant)} 
                      disabled={isGlobal}
                      title={isGlobal ? "Workspace global tidak boleh dihapus" : undefined}
                      className="text-destructive focus:text-destructive cursor-pointer text-xs rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus Workspace
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </Card>
  )
}
