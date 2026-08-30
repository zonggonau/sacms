"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Globe,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  CreditCard,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  HelpCircle,
  Tag,
  Filter,
} from "lucide-react"
import { toast } from "sonner"
import { DomainSearchResult, TldCategory } from "@/lib/vercel-registrar"

interface BuyDomainDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  onDomainPurchased?: () => void
  onSuccess?: () => void
}

export function BuyDomainDialog({
  open,
  onOpenChange,
  tenantSlug,
  onDomainPurchased,
  onSuccess,
}: BuyDomainDialogProps) {
  const { data: session } = useSession()

  const [step, setStep] = useState<"SEARCH" | "CONTACT" | "CHECKOUT" | "SUCCESS">("SEARCH")
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<DomainSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<DomainSearchResult | null>(null)
  
  // Filtering state
  const [selectedCategory, setSelectedCategory] = useState<TldCategory>("all")
  const [onlyAvailable, setOnlyAvailable] = useState(false)

  // Contact form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("Jl. Sudirman No. 1")
  const [city, setCity] = useState("Jakarta")
  const [stateName, setStateName] = useState("DKI Jakarta")
  const [postalCode, setPostalCode] = useState("10220")
  const [country, setCountry] = useState("ID")
  const [companyName, setCompanyName] = useState("")

  // Checkout state
  const [processingPayment, setProcessingPayment] = useState(false)
  const [purchasedDomainName, setPurchasedDomainName] = useState("")

  // Pre-fill user data when session loads
  useEffect(() => {
    if (session?.user) {
      const names = (session.user.name || "").trim().split(" ")
      setFirstName(names[0] || "Admin")
      setLastName(names.slice(1).join(" ") || "Owner")
      setEmail(session.user.email || "")
    }
  }, [session])

  // Reset state when dialog reopens
  useEffect(() => {
    if (open) {
      setStep("SEARCH")
      setSelectedDomain(null)
    }
  }, [open])

  // Handle Domain Search
  async function handleSearch(e?: React.FormEvent, customQuery?: string) {
    if (e) e.preventDefault()
    const query = (customQuery !== undefined ? customQuery : searchQuery).trim()
    if (!query || query.length < 2) {
      toast.error("Silakan masukkan nama domain minimal 2 karakter.")
      return
    }

    setSearching(true)
    setHasSearched(true)
    try {
      const res = await fetch(
        `/api/tenant/${tenantSlug}/domains/search?name=${encodeURIComponent(query)}`
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Pencarian domain gagal")
      }

      setSearchResults(data.results || [])
    } catch (err: any) {
      toast.error(err.message || "Gagal mencari ketersediaan domain")
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  // Filtered domain results based on category & availability toggle
  const filteredResults = useMemo(() => {
    return searchResults.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false
      }
      if (onlyAvailable && !item.available) {
        return false
      }
      return true
    })
  }, [searchResults, selectedCategory, onlyAvailable])

  // Count available domains
  const availableCount = useMemo(() => {
    return searchResults.filter((r) => r.available).length
  }, [searchResults])

  // Handle Select Domain
  function handleSelectDomain(domainItem: DomainSearchResult) {
    if (!domainItem.available) return
    setSelectedDomain(domainItem)
    setStep("CONTACT")
  }

  // Handle Proceed to Checkout
  function handleProceedToSummary(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Nama, Email, dan No. Telepon wajib diisi.")
      return
    }
    setStep("CHECKOUT")
  }

  // Handle Trigger Midtrans Payment
  async function handlePayWithMidtrans() {
    if (!selectedDomain) return

    setProcessingPayment(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/domains/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: selectedDomain.domain,
          contactInformation: {
            firstName: firstName.trim(),
            lastName: lastName.trim() || "Owner",
            address1: address.trim() || "Jl. Sudirman No. 1",
            city: city.trim() || "Jakarta",
            state: stateName.trim() || "DKI Jakarta",
            postalCode: postalCode.trim() || "10220",
            country: country.trim() || "ID",
            phone: phone.trim(),
            email: email.trim(),
            companyName: companyName.trim() || undefined,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.token) {
        throw new Error(data.error || "Gagal menginisialisasi pembayaran")
      }

      // Check if Midtrans Snap script is loaded
      if (typeof window !== "undefined" && (window as any).snap) {
        (window as any).snap.pay(data.token, {
          onSuccess: async () => {
            toast.success("Pembayaran Berhasil!", {
              description: `Domain ${selectedDomain.domain} berhasil dibeli dan terdaftar!`,
            })
            setPurchasedDomainName(selectedDomain.domain)
            setStep("SUCCESS")
            if (onDomainPurchased) onDomainPurchased()
          },
          onPending: () => {
            toast.info("Menunggu Pembayaran", {
              description: "Silakan selesaikan pembayaran sesuai instruksi.",
            })
            setPurchasedDomainName(selectedDomain.domain)
            setStep("SUCCESS")
            if (onDomainPurchased) onDomainPurchased()
          },
          onError: () => {
            toast.error("Pembayaran Gagal", {
              description: "Transaksi tidak dapat diselesaikan. Silakan coba kembali.",
            })
          },
          onClose: () => {
            setProcessingPayment(false)
          },
        })
      } else {
        // Fallback: Redirect URL if Snap modal not attached
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl
        } else {
          toast.error("Sistem pembayaran belum siap. Silakan muat ulang halaman.")
        }
      }
    } catch (err: any) {
      toast.error("Gagal Memulai Pembayaran", {
        description: err.message,
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  const formatIdr = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden rounded-2xl gap-0 border-border/80 bg-card">
        
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Beli Domain Kustom
                <Badge variant="secondary" className="text-[10px] font-mono tracking-wider font-semibold">
                  VERCEL REGISTRAR
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cari dan beli domain resmi dengan aktivasi otomatis & auto-SSL untuk workspace Anda.
              </DialogDescription>
            </div>
          </div>

          {/* Stepper Wizard */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40 mt-3 text-xs">
            <div className={`flex items-center gap-1.5 font-bold ${step === "SEARCH" ? "text-primary" : "text-muted-foreground"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === "SEARCH" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>1</span>
              Pilih Domain
            </div>
            <div className="h-px bg-border flex-1 mx-3" />
            <div className={`flex items-center gap-1.5 font-bold ${step === "CONTACT" ? "text-primary" : "text-muted-foreground"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === "CONTACT" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2</span>
              Data Kontak WHOIS
            </div>
            <div className="h-px bg-border flex-1 mx-3" />
            <div className={`flex items-center gap-1.5 font-bold ${step === "CHECKOUT" || step === "SUCCESS" ? "text-primary" : "text-muted-foreground"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === "CHECKOUT" || step === "SUCCESS" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>3</span>
              Pembayaran
            </div>
          </div>
        </DialogHeader>

        {/* Step 1: SEARCH & ALL DOMAINS LIST */}
        {step === "SEARCH" && (
          <div className="p-6 space-y-5">
            {/* Search Input Bar */}
            <form onSubmit={(e) => handleSearch(e)} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ketik nama domain (contoh: delvia, intanjayakab, perusahaanku.com)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 font-mono text-xs h-10 rounded-xl bg-background border-border/80"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="rounded-xl h-10 px-5 font-bold text-xs bg-primary text-primary-foreground shadow-xs shrink-0"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                    Cari Domain
                  </>
                )}
              </Button>
            </form>

            {/* Quick Popular Keywords Suggestion */}
            {!hasSearched && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] text-muted-foreground font-semibold">Pencarian Cepat Populer:</span>
                <div className="flex flex-wrap gap-1.5">
                  {["delvia", "intanjaya", "portal-desa", "nusantara", "media-cms"].map((tag) => (
                    <Button
                      key={tag}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery(tag)
                        handleSearch(undefined, tag)
                      }}
                      className="h-7 text-[11px] font-mono rounded-lg border-border/70 text-muted-foreground hover:text-foreground"
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results Display */}
            {hasSearched && (
              <div className="space-y-4">
                
                {/* Category Filters Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border/60">
                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: "all", label: "Semua" },
                      { id: "id", label: "🇮🇩 Indonesia (.ID)" },
                      { id: "global", label: "🌐 Global" },
                      { id: "tech", label: "⚡ Tech & AI" },
                      { id: "budget", label: "🏷️ Ekonomis" },
                    ].map((cat) => (
                      <Button
                        key={cat.id}
                        type="button"
                        variant={selectedCategory === cat.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(cat.id as TldCategory)}
                        className={`h-7 px-2.5 text-[11px] font-bold rounded-lg ${
                          selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "border-border/70"
                        }`}
                      >
                        {cat.label}
                      </Button>
                    ))}
                  </div>

                  {/* Available only toggle */}
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <Label htmlFor="available-only" className="text-[11px] font-semibold text-muted-foreground cursor-pointer">
                      Hanya Tersedia ({availableCount})
                    </Label>
                    <Switch
                      id="available-only"
                      checked={onlyAvailable}
                      onCheckedChange={setOnlyAvailable}
                    />
                  </div>
                </div>

                {/* Results Count Header */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Ditemukan <strong>{filteredResults.length}</strong> domain untuk &quot;{searchQuery}&quot;:
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    *Harga per 1 tahun pendaftaran
                  </span>
                </div>

                {/* Domains List */}
                <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
                  {filteredResults.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl p-6 bg-muted/10">
                      Tidak ada domain yang cocok dengan filter yang dipilih.
                    </div>
                  ) : (
                    filteredResults.map((item) => (
                      <Card
                        key={item.domain}
                        className={`rounded-xl border transition-all duration-150 ${
                          item.available
                            ? "border-border/80 bg-card hover:border-primary/50 hover:shadow-xs"
                            : "border-border/40 bg-muted/20 opacity-65"
                        }`}
                      >
                        <CardContent className="p-3.5 flex items-center justify-between gap-3">
                          {/* Domain Info */}
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm text-foreground truncate">
                                {item.domain}
                              </span>
                              {item.badge && (
                                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 py-0 px-1.5 rounded-md font-semibold">
                                  {item.badge}
                                </Badge>
                              )}
                              {item.available ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 py-0 px-1.5 rounded-md font-bold">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Tersedia
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 py-0 px-1.5 rounded-md font-bold">
                                  <XCircle className="w-2.5 h-2.5 mr-1" /> Terdaftar
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {item.available
                                ? "Siap didaftarkan langsung ke akun Anda."
                                : "Domain sudah dimiliki pihak lain."}
                            </p>
                          </div>

                          {/* Price & Action Button */}
                          <div className="flex items-center gap-3 shrink-0">
                            {item.available && (
                              <div className="text-right">
                                <div className="font-black text-sm text-foreground">
                                  {formatIdr(item.priceIdr)}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  ${item.priceUsd}.00 USD / thn
                                </div>
                              </div>
                            )}

                            <Button
                              onClick={() => handleSelectDomain(item)}
                              disabled={!item.available}
                              size="sm"
                              className={`rounded-xl text-xs font-bold h-8 px-3.5 shadow-xs ${
                                item.available
                                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                  : "bg-muted text-muted-foreground border border-border"
                              }`}
                            >
                              {item.available ? (
                                <>
                                  Pilih & Beli
                                  <ArrowRight className="ml-1 h-3 w-3" />
                                </>
                              ) : (
                                "Tidak Tersedia"
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: CONTACT INFORMATION */}
        {step === "CONTACT" && selectedDomain && (
          <form onSubmit={handleProceedToSummary} className="p-6 space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Domain Dipilih:</span>
                <p className="font-mono font-bold text-sm text-primary">{selectedDomain.domain}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Harga Tahunan:</span>
                <p className="font-bold text-sm text-foreground">{formatIdr(selectedDomain.priceIdr)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold text-foreground">
                Data Registran Domain (Registrant Contact)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Data wajib untuk registrasi resmi ICANN / PANDI (.ID). Informasi dilindungi oleh WHOIS Privacy Protection bawaan.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-[11px] font-semibold">Nama Depan *</Label>
                  <Input
                    id="firstName"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-[11px] font-semibold">Nama Belakang *</Label>
                  <Input
                    id="lastName"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-[11px] font-semibold">Alamat Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-[11px] font-semibold">No. Telepon / WhatsApp *</Label>
                  <Input
                    id="phone"
                    required
                    placeholder="+628123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-8 text-xs rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="companyName" className="text-[11px] font-semibold">Nama Perusahaan / Instansi (Opsional)</Label>
                <Input
                  id="companyName"
                  placeholder="PT. Inovasi Digital Nusantara"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-8 text-xs rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="address" className="text-[11px] font-semibold">Alamat</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-[11px] font-semibold">Kota</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 flex justify-between gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("SEARCH")}
                className="h-9 text-xs rounded-xl"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Pilih Domain Lain
              </Button>
              <Button
                type="submit"
                className="h-9 text-xs font-bold rounded-xl bg-primary text-primary-foreground"
              >
                Lanjut ke Ringkasan Biaya
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Step 3: CHECKOUT & MIDTRANS */}
        {step === "CHECKOUT" && selectedDomain && (
          <div className="p-6 space-y-5">
            <Card className="rounded-xl border border-border/80 bg-muted/10 overflow-hidden">
              <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Item Pembelian:</span>
                  <p className="font-mono font-bold text-base text-foreground">{selectedDomain.domain}</p>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                  1 Tahun Langganan
                </Badge>
              </div>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Biaya Registrasi Domain:</span>
                  <span className="font-mono">{formatIdr(selectedDomain.priceIdr - 25000)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>WHOIS Privacy & DNS Anycast:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">GRATIS</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Biaya Administrasi & Payment Gateway:</span>
                  <span className="font-mono">Rp 25.000</span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-bold text-sm text-foreground pt-1">
                  <span>Total Tagihan:</span>
                  <span className="text-primary font-black text-base font-mono">{formatIdr(selectedDomain.priceIdr)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Aktivasi Otomatis SaCMS Edge Routing
              </p>
              <p className="text-[11px]">
                Setelah pembayaran selesai via Midtrans (QRIS / Virtual Account / Kartu Kredit), domain akan langsung terhubung dan otomatis mengaktifkan sertifikat SSL Let&apos;s Encrypt.
              </p>
            </div>

            <DialogFooter className="pt-2 flex justify-between gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setStep("CONTACT")}
                disabled={processingPayment}
                className="h-9 text-xs rounded-xl"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Kembali
              </Button>
              <Button
                onClick={handlePayWithMidtrans}
                disabled={processingPayment}
                className="h-9 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-xs"
              >
                {processingPayment ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                )}
                Bayar Sekarang via Midtrans
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: SUCCESS */}
        {step === "SUCCESS" && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-lg text-foreground">Pemesanan Domain Berhasil!</h3>
              <p className="font-mono text-xs font-bold text-primary">{purchasedDomainName}</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto pt-1">
                Domain Anda sedang diproses oleh registrar dan akan aktif dalam hitungan menit secara otomatis di dashboard.
              </p>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-9 px-6 font-bold text-xs bg-primary text-primary-foreground"
            >
              Selesai & Buka Dashboard Domain
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}
