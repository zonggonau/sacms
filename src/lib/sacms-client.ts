// src/lib/sacms-client.ts

/**
 * A lightweight client to consume the SaCMS public REST API.
 * This demonstrates how an external frontend (or this frontend itself)
 * fetches content headlessly.
 */

const API_KEY = process.env.NEXT_PUBLIC_SACMS_GLOBAL_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd";
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TENANT_SLUG = "sacms-global";

export async function fetchCollection(contentTypeSlug: string, queryParams: string = "") {
  try {
    const url = `${BASE_URL}/api/public/${TENANT_SLUG}/content/${contentTypeSlug}${queryParams ? `?${queryParams}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Host': 'localhost'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      console.warn(`[SaCMS Client] Failed to fetch collection ${contentTypeSlug}: ${res.statusText}`);
      return [];
    }

    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error(`[SaCMS Client] Error fetching ${contentTypeSlug}:`, error);
    return [];
  }
}

export async function fetchSingle(singleTypeSlug: string, queryParams: string = "") {
  try {
    const url = `${BASE_URL}/api/public/${TENANT_SLUG}/single/${singleTypeSlug}${queryParams ? `?${queryParams}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Host': 'localhost'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      console.warn(`[SaCMS Client] Failed to fetch single ${singleTypeSlug}: ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    return json.data || null;
  } catch (error) {
    console.error(`[SaCMS Client] Error fetching ${singleTypeSlug}:`, error);
    return null;
  }
}
