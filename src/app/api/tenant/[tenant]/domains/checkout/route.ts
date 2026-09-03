import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { createSnapPayment } from "@/lib/midtrans"
import {
  checkDomainAvailability,
  getDomainPrice,
  convertUsdToIdr,
  ContactInformation,
} from "@/lib/vercel-registrar"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(
  async (request, _context, { access }) => {
    const body = await request.json()
    const { domain, contactInformation } = body as {
      domain: string
      contactInformation: ContactInformation
    }

    if (!domain || typeof domain !== "string") {
      return apiError("validation", { message: "Nama domain wajib diisi" })
    }

    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")

    if (!contactInformation?.firstName || !contactInformation?.email || !contactInformation?.phone) {
      return apiError("validation", {
        message: "Data kontak pendaftar (nama, email, no. telp) wajib diisi",
      })
    }

    const avail = await checkDomainAvailability(cleanDomain)
    if (!avail.available) {
      return apiError("validation", {
        message: `Domain ${cleanDomain} saat ini tidak tersedia untuk didaftarkan.`,
      })
    }

    const existingInDb = await db.customDomain.findUnique({ where: { domain: cleanDomain } })
    if (existingInDb) {
      return apiError("conflict", { message: `Domain ${cleanDomain} sudah terdaftar di sistem SaCMS.` })
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
  },
  { minRole: "admin" },
)
