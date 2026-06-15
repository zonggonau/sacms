// src/lib/sacms-client.ts

/**
 * A lightweight client to consume the SaCMS public REST API.
 * This demonstrates how an external frontend (or this frontend itself)
 * fetches content headlessly.
 */

const API_KEY = process.env.NEXT_PUBLIC_SACMS_GLOBAL_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TENANT_SLUG = "sacms-global";

async function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return DEFAULT_BASE_URL;
}

export async function fetchCollection(contentTypeSlug: string, queryParams: string = "", customBaseUrl?: string) {
  try {
    const baseUrl = customBaseUrl || await getBaseUrl();
    // Fetch from global content endpoint (tenantId IS NULL)
    const url = `${baseUrl}/api/public/content/${contentTypeSlug}${queryParams ? `?${queryParams}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      // Fallback: If global fetch fails, try legacy sacms-global tenant route
      const legacyUrl = `${baseUrl}/api/public/${TENANT_SLUG}/content/${contentTypeSlug}${queryParams ? `?${queryParams}` : ''}`;
      const legacyRes = await fetch(legacyUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        cache: 'no-store'
      });
      
      if (!legacyRes.ok) {
        console.warn(`[SaCMS Client] Failed to fetch collection ${contentTypeSlug}: ${legacyRes.statusText}`);
        return [];
      }
      const legacyJson = await legacyRes.json();
      return legacyJson.data || [];
    }

    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error(`[SaCMS Client] Error fetching ${contentTypeSlug}:`, error);
    return [];
  }
}

export async function fetchSingle(singleTypeSlug: string, queryParams: string = "", customBaseUrl?: string) {
  try {
    const baseUrl = customBaseUrl || await getBaseUrl();
    // Fetch from global single type endpoint
    const url = `${baseUrl}/api/public/single/${singleTypeSlug}${queryParams ? `?${queryParams}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      // Fallback to legacy sacms-global route
      const legacyUrl = `${baseUrl}/api/public/${TENANT_SLUG}/single/${singleTypeSlug}${queryParams ? `?${queryParams}` : ''}`;
      const legacyRes = await fetch(legacyUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        cache: 'no-store'
      });
      
      if (!legacyRes.ok) {
        console.warn(`[SaCMS Client] Failed to fetch single ${singleTypeSlug}: ${legacyRes.statusText}`);
        return null;
      }
      const legacyJson = await legacyRes.json();
      return legacyJson.data || null;
    }

    const json = await res.json();
    return json.data || null;
  } catch (error) {
    console.error(`[SaCMS Client] Error fetching ${singleTypeSlug}:`, error);
    return null;
  }
}
