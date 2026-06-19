import { z } from "zod"

const SOURCE_TYPES = ["LIVE", "CANVA", "ANNOUNCEMENT", "VIDEO_LOOP", "PDF", "IMAGE_SLIDES"] as const

const sourceUrlSchema = z.string().refine(
  (url) => {
    if (!url) return true
    if (url.startsWith("/")) return true
    try {
      const { hostname } = new URL(url)
      return hostname === "www.canva.com" || hostname === "canva.com"
    } catch {
      return true // filenames sin slash, no son URLs
    }
  },
  { message: "sourceUrl must be a local path or a canva.com URL" }
)

export const schedulePostSchema = z.object({
  tvIds: z.array(z.number()).min(1),
  sourceType: z.enum(SOURCE_TYPES),
  channelId: z.number().optional(),
  sourceUrl: sourceUrlSchema.optional(),
  content: z.string().optional(),
  bgColor: z.string().optional(),
  textColor: z.string().optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
})

export const tvsPatchSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  defaultChannel: z.number().optional(),
}).refine((d) => d.name !== undefined || d.defaultChannel !== undefined, {
  message: "at least one of name or defaultChannel required",
})

export const channelSourceSchema = z.object({
  name: z.string().min(1).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  sourceUrl: sourceUrlSchema.optional(),
  content: z.string().optional(),
  bgColor: z.string().optional(),
  textColor: z.string().optional(),
})

export const userPostSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["admin", "rrhh", "jefe", "tv"]),
  name: z.string().min(1),
})

export const userPatchSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "rrhh", "jefe", "tv"]).optional(),
  name: z.string().min(1).optional(),
})
