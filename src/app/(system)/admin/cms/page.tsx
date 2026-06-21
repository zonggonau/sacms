import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, FileText } from "lucide-react"

export default function AdminCMSPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[80vh] text-center space-y-6">
      <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center">
        <Database className="h-10 w-10" />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Global CMS</h1>
        <p className="text-muted-foreground text-lg max-w-lg">
          Welcome to the Global Content Management System. Here you can manage data for global content types and single types.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
        <Card className="bg-white border-slate-200 shadow-sm rounded-none text-left">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Database className="h-4 w-4 text-orange-500" />
              Content Types
            </CardTitle>
            <CardDescription className="text-xs">
              Manage entries for global collections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Select a content type from the sidebar to view, create, or edit its entries.</p>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-slate-200 shadow-sm rounded-none text-left">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              Single Types
            </CardTitle>
            <CardDescription className="text-xs">
              Manage global singleton pages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Select a single type from the sidebar to edit its content.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
