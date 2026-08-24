export interface DnsRecordResult {
  id: string
  name: string
  type: string
  content: string
  proxied: boolean
}

export function isCloudflareConfigured(): boolean {
  return !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID)
}

function getCloudflareHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Create or update an A record on Cloudflare DNS
 * @param recordName Full hostname e.g. "db-acme.sacms.cloud"
 * @param ipv4 IP Address of the VPS
 * @param proxied False for Direct TCP/Let's Encrypt (recommended for DB and custom Caddy)
 */
export async function createOrUpdateDnsRecord(
  recordName: string,
  ipv4: string,
  proxied = false
): Promise<DnsRecordResult> {
  if (!isCloudflareConfigured()) {
    console.warn(`[Cloudflare DNS] Running in SIMULATION mode for record: ${recordName} -> ${ipv4}`)
    return {
      id: `sim-dns-${Date.now()}`,
      name: recordName,
      type: 'A',
      content: ipv4,
      proxied,
    }
  }

  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const baseUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`

  // 1. Check if record already exists
  const searchUrl = `${baseUrl}?type=A&name=${encodeURIComponent(recordName)}`
  const searchRes = await fetch(searchUrl, {
    method: 'GET',
    headers: getCloudflareHeaders(),
  })

  if (!searchRes.ok) {
    const errText = await searchRes.text()
    throw new Error(`Cloudflare DNS lookup failed: ${errText}`)
  }

  const searchData = await searchRes.json()
  const existingRecord = searchData.result?.[0]

  if (existingRecord) {
    // 2. Update existing record
    const updateRes = await fetch(`${baseUrl}/${existingRecord.id}`, {
      method: 'PUT',
      headers: getCloudflareHeaders(),
      body: JSON.stringify({
        type: 'A',
        name: recordName,
        content: ipv4,
        ttl: 1, // Auto TTL
        proxied,
      }),
    })

    if (!updateRes.ok) {
      const errText = await updateRes.text()
      throw new Error(`Failed to update Cloudflare DNS record: ${errText}`)
    }

    const updateData = await updateRes.json()
    return updateData.result
  }

  // 3. Create new record
  const createRes = await fetch(baseUrl, {
    method: 'POST',
    headers: getCloudflareHeaders(),
    body: JSON.stringify({
      type: 'A',
      name: recordName,
      content: ipv4,
      ttl: 1, // Auto TTL
      proxied,
    }),
  })

  if (!createRes.ok) {
    const errText = await createRes.text()
    throw new Error(`Failed to create Cloudflare DNS record: ${errText}`)
  }

  const createData = await createRes.json()
  return createData.result
}

/**
 * Delete a DNS record by its domain name
 */
export async function deleteDnsRecord(recordName: string): Promise<boolean> {
  if (!isCloudflareConfigured()) {
    console.warn(`[Cloudflare DNS] SIMULATION delete for record: ${recordName}`)
    return true
  }

  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const baseUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`

  try {
    const searchUrl = `${baseUrl}?type=A&name=${encodeURIComponent(recordName)}`
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: getCloudflareHeaders(),
    })

    if (!searchRes.ok) return false
    const searchData = await searchRes.json()
    const existingRecord = searchData.result?.[0]

    if (existingRecord) {
      const delRes = await fetch(`${baseUrl}/${existingRecord.id}`, {
        method: 'DELETE',
        headers: getCloudflareHeaders(),
      })
      return delRes.ok
    }
  } catch (error) {
    console.error(`[Cloudflare DNS] Error deleting record ${recordName}:`, error)
  }

  return false
}
