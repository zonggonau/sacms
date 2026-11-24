import { z } from "zod"

export const previewRoutePaths = z.array(z.string().max(1500).regex(/^\/(?!\/)[^\\#\s]*$/, "Expected a same-site path beginning with /")).min(1).max(10)
