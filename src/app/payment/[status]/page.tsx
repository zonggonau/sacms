import { redirect } from "next/navigation"

export default async function PaymentRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ status: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  
  // Midtrans provides order_id in query parameters upon redirect
  const orderId = resolvedSearchParams.order_id

  if (!orderId || typeof orderId !== 'string') {
    // If no order ID is provided, safely redirect to the main dashboard
    redirect("/dashboard")
  }

  // Redirect to our global payment result resolver which handles
  // tenant lookup and final status displaying based on the order ID.
  // This works for finish, unfinish, and error statuses.
  redirect(`/dashboard/payment-result/${orderId}`)
}
