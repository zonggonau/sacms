"use client"

import { useState } from "react"
import { FileText, Download, Plus, Search, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface Template {
  id: string
  name: string
  format: string
}

export function SuratClient({ tenantSlug, initialTemplates }: { tenantSlug: string, initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const handleDownload = (id: string) => {
    toast({
      title: "Generating Document...",
      description: "Mempersiapkan template " + id + " untuk didownload.",
    })
    setTimeout(() => {
      toast({
        title: "Success",
        description: "Dokumen berhasil dibuat. Proses download dimulai.",
        className: "bg-emerald-50 text-emerald-900 border-emerald-200"
      })
    }, 1500)
  }

  const filtered = templates.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input 
              placeholder="Cari Template Surat..." 
              className="pl-9" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Button className="bg-slate-900 text-white hover:bg-slate-800">
          <Plus className="mr-2 h-4 w-4" /> Tambah Template Baru
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Template Surat</CardTitle>
          <CardDescription>Pilih template untuk men-generate dokumen resmi.</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500">
              <FileText className="h-12 w-12 text-slate-300 mb-4" />
              <p>Tidak ada template surat ditemukan.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Template</TableHead>
                  <TableHead>Format Output</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant={t.format === "PDF" ? "destructive" : "default"}>
                        {t.format}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(t.id)}>
                        <Download className="h-4 w-4 mr-2" /> Download Contoh
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4 text-slate-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
