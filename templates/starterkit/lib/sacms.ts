import { SaCMS } from "@sacms/sdk";

const baseUrl = process.env.NEXT_PUBLIC_SACMS_URL;
const tenant = process.env.SACMS_TENANT;
const token = process.env.SACMS_API_TOKEN;

export const isConfigured = Boolean(baseUrl && tenant && token);

export const sacms = new SaCMS({
  baseUrl: baseUrl || "http://localhost:3000",
  tenant: tenant || "demo",
  token: token || "temporary_token",
});

// Generic Fetcher for dynamic pages
export async function resolveContent(slug: string) {
  if (!isConfigured) return null;

  try {
    // 1. Check in 'pages' collection
    const pageRes = await sacms.collection("pages").findMany({
      filters: { slug },
      pagination: { pageSize: 1 },
      populate: ["blocks", "featuredImage"] 
    } as any).catch(() => ({ data: [] })); // Silent fail for missing collection
    
    if (pageRes.data?.[0]) {
      return { type: "page", data: pageRes.data[0] };
    }

    // 2. Check in 'posts' collection
    const postRes = await sacms.collection("posts").findMany({
      filters: { slug },
      pagination: { pageSize: 1 },
      populate: ["category", "featuredImage", "author"]
    } as any).catch(() => ({ data: [] })); // Silent fail
    
    if (postRes.data?.[0]) {
      return { type: "post", data: postRes.data[0] };
    }

    // 3. Fallback: Check if it's a Single Type with this slug
    const singleRes = await sacms.single(slug).find({
      populate: ["blocks", "featuredImage", "image"]
    } as any).catch(() => ({ data: null }));

    if (singleRes.data) {
      return { type: "page", data: singleRes.data };
    }
  } catch (error) {
    // Graceful error handling to prevent 500 crash
    return null;
  }

  return null;
}

export async function getGlobalSettings() {
  if (!isConfigured) return null;
  try {
    const res = await sacms.single("global-settings").find({
      populate: ["logo", "socialLinks"]
    } as any).catch(() => ({ data: null }));
    return res.data;
  } catch {
    return null;
  }
}

export async function getNavbar() {
  if (!isConfigured) return null;
  try {
    const res = await (sacms.single("navbar") as any).find({
      populate: ["logo", "menuItems", "menuItems.children", "menuItems.children.children"]
    }).catch(() => ({ data: null }));
    return res.data;
  } catch {
    return null;
  }
}

export async function getFooter() {
  if (!isConfigured) return null;
  try {
    const res = await (sacms.single("footer") as any).find({
      populate: ["socialLinks", "sections", "sections.links"]
    }).catch(() => ({ data: null }));
    return res.data;
  } catch {
    return null;
  }
}

export async function getHomepage() {
  if (!isConfigured) return null;
  try {
    const res = await sacms.single("homepage").find({
      populate: ["blocks", "seoTitle", "seoDescription", "ogImage"]
    } as any).catch(() => ({ data: null }));
    return res.data;
  } catch {
    return null;
  }
}

export async function getMenu(slug: string = "main-menu") {
  if (!isConfigured) return null;
  try {
    // Some tenants might not have 'menus' collection yet
    const res = await sacms.collection("menus").findMany({
      filters: { slug },
      populate: ["links"]
    } as any).catch(() => ({ data: [] })); // If collection 'menus' doesn't exist, return empty array
    
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function getLatestPosts(limit = 6) {
  if (!isConfigured) return [];
  try {
    const res = await sacms.collection("posts").findMany({
      pagination: { pageSize: limit },
      sort: "createdAt:desc",
      populate: ["category", "featuredImage"]
    } as any).catch(() => ({ data: [] }));
    return res.data || [];
  } catch {
    return [];
  }
}
