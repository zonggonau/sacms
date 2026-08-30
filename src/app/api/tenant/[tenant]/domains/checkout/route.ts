import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { createSnapPayment } from "@/lib/midtrans"
import {
  checkDomainAvailability,
  getDomainPrice,
  convertUsdToIdr,
  ContactInformation,
} from "@/lib/vercel-registrar"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { domain, contactInformation } = body as {
      domain: string
      contactInformation: ContactInformation
    }

    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "Nama domain wajib diisi" }, { status: 400 })
    }

    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")

    if (!contactInformation?.firstName || !contactInformation?.email || !contactInformation?.phone) {
      return NextResponse.json(
        { error: "Data kontak pendaftar (nama, email, no. telp) wajib diisi" },
        { status: 400 }
      )
    }

    // 1. Verify availability
    const avail = await checkDomainAvailability(cleanDomain)
    if (!avail.available) {
      return NextResponse.json(
        { error: `Domain ${cleanDomain} saat ini tidak tersedia untuk didaftarkan.` },
        { status: 400 }
      )
    }

    // 2. Check if already added in SaCMS
    const existingInDb = await db.customDomain.findUnique({
      where: { domain: cleanDomain },
    })
    if (existingInDb) {
      return NextResponse.json(
        { error: `Domain ${cleanDomain} sudah terdaftar di sistem SaCMS.` },
        { status: 409 }
      )
    }

    // 3. Get pricing
    const pricing = await getDomainPrice(cleanDomain)
    const priceIdr = convertUsdToIdr(pricing.priceUsd)

    // 4. Generate unique order ID with prefix "DOM"
    const orderId = `DOM-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

    // 5. Find or prepare subscription connection (if any exists for tenant)
    const existingSubscription = await db.subscription.findFirst({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: "desc" },
    })

    // 6. Record PaymentTransaction in Database
    await db.paymentTransaction.create({
      data: {
        orderId,
        amount: priceIdr,
        status: "pending",
        subscriptionId: existingSubscription?.id || null,
        rawResponse: {
          type: "DOMAIN_PURCHASE",
          tenantId: access.tenantId,
          domainName: cleanDomain,
          expectedPriceUsd: pricing.priceUsd,
          periodYears: pricing.periodYears || 1,
          priceIdr,
          contactInformation,
        } as any,
      },
    })

    // 7. Create Midtrans Snap Payment
    const snapResult = await createSnapPayment({
      orderId,
      amount: priceIdr,
      customerDetails: {
        firstName: contactInformation.firstName,
        lastName: contactInformation.lastName || "",
        email: contactInformation.email,
        phone: contactInformation.phone,
      },
      items: [
        {
          id: `domain_${cleanDomain.replace(/[^a-zA-Z0-9]/g, "_")}`,
          name: `Pendaftaran Domain ${cleanDomain} (1 Thn)`,
          price: priceIdr,
          quantity: 1,
        },
      ],
    })

    return NextResponse.json({
      success: true,
      token: snapResult.token,
      redirectUrl: snapResult.redirect_url,
      orderId,
      amount: priceIdr,
      domain: cleanDomain,
    })
  } catch (error: any) {
    console.error("[Domain Checkout API] Error initiating checkout:", error)
    return NextResponse.json(
      { error: error.message || "Gagal membuat transaksi checkout domain" },
      { status: 500 }
    )
  }
}
