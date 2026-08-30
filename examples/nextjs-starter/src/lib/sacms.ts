import { SaCMS } from "@sacms/sdk";

export const sacms = new SaCMS({
  baseUrl: process.env.SACMS_BASE_URL || "http://localhost:3000",
  tenant: process.env.SACMS_TENANT || "demo",
  token: process.env.SACMS_API_TOKEN || "cf_live_sample_token",
  locale: process.env.SACMS_DEFAULT_LOCALE || "id",
});
