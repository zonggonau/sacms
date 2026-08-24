export interface ContaboPlanDefinition {
  id: string
  name: string
  productId: string
  type: 'VPS' | 'VDS'
  cpuCores: number
  isDedicatedCpu: boolean
  ramMb: number
  diskGb: number
  bandwidthMbps: number
  monthlyPriceEur: number
  monthlyPriceIdr: number
  description: string
  regions: string[]
}

export const CONTABO_PLANS: Record<string, ContaboPlanDefinition> = {
  // ─── Cloud VPS (Shared Burstable Cores) ───
  "vps-s": {
    id: "vps-s",
    name: "Cloud VPS S",
    productId: "V4",
    type: "VPS",
    cpuCores: 4,
    isDedicatedCpu: false,
    ramMb: 8192,
    diskGb: 75,
    bandwidthMbps: 200,
    monthlyPriceEur: 5.50,
    monthlyPriceIdr: 750000,
    description: "4 vCPU, 8 GB RAM, 75 GB NVMe (Shared Cores, Cost-Effective)",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "US-west", "UK", "JPN", "AUS"],
  },
  "vps-m": {
    id: "vps-m",
    name: "Cloud VPS M",
    productId: "V8",
    type: "VPS",
    cpuCores: 6,
    isDedicatedCpu: false,
    ramMb: 16384,
    diskGb: 150,
    bandwidthMbps: 400,
    monthlyPriceEur: 10.50,
    monthlyPriceIdr: 1450000,
    description: "6 vCPU, 16 GB RAM, 150 GB NVMe (High-traffic Content)",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "US-west", "UK", "JPN", "AUS"],
  },
  "vps-l": {
    id: "vps-l",
    name: "Cloud VPS L",
    productId: "V16",
    type: "VPS",
    cpuCores: 8,
    isDedicatedCpu: false,
    ramMb: 24576,
    diskGb: 300,
    bandwidthMbps: 600,
    monthlyPriceEur: 17.50,
    monthlyPriceIdr: 2450000,
    description: "8 vCPU, 24 GB RAM, 300 GB NVMe (Large Media & Content)",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "US-west", "UK", "JPN", "AUS"],
  },
  "vps-xl": {
    id: "vps-xl",
    name: "Cloud VPS XL",
    productId: "V32",
    type: "VPS",
    cpuCores: 10,
    isDedicatedCpu: false,
    ramMb: 32768,
    diskGb: 400,
    bandwidthMbps: 800,
    monthlyPriceEur: 29.00,
    monthlyPriceIdr: 3950000,
    description: "10 vCPU, 32 GB RAM, 400 GB NVMe (Enterprise Scalability)",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "US-west", "UK", "JPN", "AUS"],
  },
  "vps-xxl": {
    id: "vps-xxl",
    name: "Cloud VPS XXL",
    productId: "V64",
    type: "VPS",
    cpuCores: 12,
    isDedicatedCpu: false,
    ramMb: 65536,
    diskGb: 600,
    bandwidthMbps: 1000,
    monthlyPriceEur: 49.00,
    monthlyPriceIdr: 5950000,
    description: "12 vCPU, 64 GB RAM, 600 GB NVMe (Maximum Compute VPS)",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "US-west", "UK", "JPN", "AUS"],
  },

  // ─── Cloud VDS (100% Dedicated Physical Cores) ───
  "vds-s": {
    id: "vds-s",
    name: "Cloud VDS S (100% Dedicated CPU)",
    productId: "DS3",
    type: "VDS",
    cpuCores: 3,
    isDedicatedCpu: true,
    ramMb: 24576,
    diskGb: 180,
    bandwidthMbps: 250,
    monthlyPriceEur: 37.00,
    monthlyPriceIdr: 3950000,
    description: "3 Dedicated Physical Cores (No Noisy Neighbor), 24 GB RAM, 180 GB NVMe, 250 Mbps",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "UK"],
  },
  "vds-m": {
    id: "vds-m",
    name: "Cloud VDS M (100% Dedicated CPU)",
    productId: "DS4",
    type: "VDS",
    cpuCores: 4,
    isDedicatedCpu: true,
    ramMb: 32768,
    diskGb: 240,
    bandwidthMbps: 500,
    monthlyPriceEur: 49.00,
    monthlyPriceIdr: 5450000,
    description: "4 Dedicated Physical Cores (100% CPU lock), 32 GB RAM, 240 GB NVMe, 500 Mbps",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "UK"],
  },
  "vds-l": {
    id: "vds-l",
    name: "Cloud VDS L (100% Dedicated CPU)",
    productId: "DS6",
    type: "VDS",
    cpuCores: 6,
    isDedicatedCpu: true,
    ramMb: 49152,
    diskGb: 360,
    bandwidthMbps: 750,
    monthlyPriceEur: 69.00,
    monthlyPriceIdr: 7950000,
    description: "6 Dedicated Physical Cores, 48 GB RAM, 360 GB NVMe, 750 Mbps Port",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "UK"],
  },
  "vds-xl": {
    id: "vds-xl",
    name: "Cloud VDS XL (100% Dedicated CPU)",
    productId: "DS8",
    type: "VDS",
    cpuCores: 8,
    isDedicatedCpu: true,
    ramMb: 65536,
    diskGb: 480,
    bandwidthMbps: 1000,
    monthlyPriceEur: 89.00,
    monthlyPriceIdr: 9950000,
    description: "8 Dedicated Physical Cores, 64 GB RAM, 480 GB NVMe, 1 Gbps Port",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "UK"],
  },
  "vds-xxl": {
    id: "vds-xxl",
    name: "Cloud VDS XXL (100% Dedicated CPU)",
    productId: "DS12",
    type: "VDS",
    cpuCores: 12,
    isDedicatedCpu: true,
    ramMb: 98304,
    diskGb: 720,
    bandwidthMbps: 1000,
    monthlyPriceEur: 149.00,
    monthlyPriceIdr: 16500000,
    description: "12 Dedicated Physical Cores, 96 GB RAM, 720 GB NVMe, 1 Gbps Port",
    regions: ["EU (Germany)", "SIN (Singapore)", "US-central", "US-east", "UK"],
  },
}

/**
 * Get full list of available Contabo VPS & VDS plans
 */
export function getContaboPlansList(): ContaboPlanDefinition[] {
  return Object.values(CONTABO_PLANS)
}

export interface ContaboConfig {
  clientId: string
  clientSecret: string
  apiUser: string
  apiPassword: string
  authUrl?: string
  apiUrl?: string
}

export interface CreateInstanceParams {
  displayName: string
  userData: string // Cloud-init script
  productId?: string // e.g. "V4" for VPS S, "V8" for VPS M, "DS3" for VDS S
  region?: string // "EU", "US-central", "SIN"
  imageId?: string // "ubuntu-24.04"
  period?: number // 1 month
}

export interface ContaboInstanceResponse {
  instanceId: string | number
  name: string
  status: string
  ipv4: string
  ipv6?: string
  cpuCores: number
  ramMb: number
  diskGb: number
  region: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

function getContaboCredentials(): ContaboConfig {
  return {
    clientId: process.env.CONTABO_CLIENT_ID || '',
    clientSecret: process.env.CONTABO_CLIENT_SECRET || '',
    apiUser: process.env.CONTABO_API_USER || '',
    apiPassword: process.env.CONTABO_API_PASSWORD || '',
    authUrl: process.env.CONTABO_AUTH_URL || 'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token',
    apiUrl: process.env.CONTABO_API_URL || 'https://api.contabo.com/v1/compute/instances',
  }
}

/**
 * Check if live Contabo credentials are configured
 */
export function isContaboConfigured(): boolean {
  const creds = getContaboCredentials()
  return !!(creds.clientId && creds.clientSecret && creds.apiUser && creds.apiPassword)
}

/**
 * Retrieve or refresh Contabo OAuth2 access token
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 30000) {
    return cachedToken.token
  }

  const creds = getContaboCredentials()
  if (!isContaboConfigured()) {
    throw new Error('Contabo API credentials are not configured in environment variables.')
  }

  const bodyParams = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    username: creds.apiUser,
    password: creds.apiPassword,
    grant_type: 'password',
  })

  const res = await fetch(creds.authUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Contabo OAuth2 authentication failed (${res.status}): ${errText}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 300) * 1000,
  }

  return cachedToken.token
}

function getRequestHeaders(token: string) {
  const requestId = crypto.randomUUID()
  return {
    Authorization: `Bearer ${token}`,
    'x-request-id': requestId,
    'x-trace-id': requestId,
    'Content-Type': 'application/json',
  }
}

/**
 * Order & Create a new VPS instance on Contabo
 */
export async function createContaboInstance(params: CreateInstanceParams): Promise<ContaboInstanceResponse> {
  // If not configured (e.g. local dev / test), return a deterministic simulated instance
  if (!isContaboConfigured()) {
    console.warn('[Contabo API] Running in SIMULATION mode (missing credentials).')
    const mockId = Math.floor(100000 + Math.random() * 900000)
    const mockIp = `161.97.${Math.floor(Math.random() * 250)}.${Math.floor(1 + Math.random() * 250)}`
    const planObj = Object.values(CONTABO_PLANS).find(p => p.productId === params.productId || p.id === params.productId)
    return {
      instanceId: `sim-${mockId}`,
      name: params.displayName,
      status: 'provisioning',
      ipv4: mockIp,
      cpuCores: planObj ? planObj.cpuCores : 4,
      ramMb: planObj ? planObj.ramMb : 8192,
      diskGb: planObj ? planObj.diskGb : 75,
      region: params.region || 'EU',
    }
  }

  const token = await getAccessToken()
  const creds = getContaboCredentials()

  const payload = {
    imageId: params.imageId || 'ubuntu-24.04',
    productId: params.productId || 'V4', // VPS S
    region: params.region || 'EU',
    period: params.period || 1,
    displayName: params.displayName,
    userData: Buffer.from(params.userData).toString('base64'),
  }

  const res = await fetch(creds.apiUrl!, {
    method: 'POST',
    headers: getRequestHeaders(token),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Contabo instance creation failed (${res.status}): ${errText}`)
  }

  const result = await res.json()
  const instance = result.data?.[0] || result.data || result

  return {
    instanceId: instance.instanceId || instance.id,
    name: instance.displayName || instance.name || params.displayName,
    status: instance.status || 'provisioning',
    ipv4: instance.ipConfig?.v4?.ip || instance.ipv4 || '',
    ipv6: instance.ipConfig?.v6?.ip || instance.ipv6 || '',
    cpuCores: instance.cpuCores || 4,
    ramMb: instance.ramMb || 8192,
    diskGb: Math.round((instance.diskMb || 76800) / 1024),
    region: instance.region || params.region || 'EU',
  }
}

/**
 * Fetch instance details and IP status from Contabo
 */
export async function getContaboInstance(instanceId: string | number): Promise<ContaboInstanceResponse> {
  if (typeof instanceId === 'string' && instanceId.startsWith('sim-')) {
    return {
      instanceId,
      name: 'Simulated VPS',
      status: 'ok',
      ipv4: '127.0.0.1',
      cpuCores: 4,
      ramMb: 8192,
      diskGb: 75,
      region: 'EU',
    }
  }

  const token = await getAccessToken()
  const creds = getContaboCredentials()

  const res = await fetch(`${creds.apiUrl}/${instanceId}`, {
    method: 'GET',
    headers: getRequestHeaders(token),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to fetch Contabo instance ${instanceId} (${res.status}): ${errText}`)
  }

  const result = await res.json()
  const instance = result.data?.[0] || result.data || result

  return {
    instanceId: instance.instanceId || instance.id,
    name: instance.displayName || instance.name,
    status: instance.status || 'unknown',
    ipv4: instance.ipConfig?.v4?.ip || instance.ipv4 || '',
    ipv6: instance.ipConfig?.v6?.ip || instance.ipv6 || '',
    cpuCores: instance.cpuCores || 4,
    ramMb: instance.ramMb || 8192,
    diskGb: Math.round((instance.diskMb || 76800) / 1024),
    region: instance.region || 'EU',
  }
}

/**
 * Restart a Contabo VPS instance
 */
export async function restartContaboInstance(instanceId: string | number): Promise<boolean> {
  if (typeof instanceId === 'string' && instanceId.startsWith('sim-')) {
    return true
  }

  const token = await getAccessToken()
  const creds = getContaboCredentials()

  const res = await fetch(`${creds.apiUrl}/${instanceId}/actions/restart`, {
    method: 'POST',
    headers: getRequestHeaders(token),
  })

  return res.ok
}

/**
 * Stop/Suspend a Contabo VPS instance
 */
export async function stopContaboInstance(instanceId: string | number): Promise<boolean> {
  if (typeof instanceId === 'string' && instanceId.startsWith('sim-')) {
    return true
  }

  const token = await getAccessToken()
  const creds = getContaboCredentials()

  const res = await fetch(`${creds.apiUrl}/${instanceId}/actions/stop`, {
    method: 'POST',
    headers: getRequestHeaders(token),
  })

  return res.ok
}

/**
 * Terminate/Delete a Contabo VPS instance
 */
export async function deleteContaboInstance(instanceId: string | number): Promise<boolean> {
  if (typeof instanceId === 'string' && instanceId.startsWith('sim-')) {
    return true
  }

  const token = await getAccessToken()
  const creds = getContaboCredentials()

  const res = await fetch(`${creds.apiUrl}/${instanceId}`, {
    method: 'DELETE',
    headers: getRequestHeaders(token),
  })

  return res.ok
}
