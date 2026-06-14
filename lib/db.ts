import { promises as fs } from "fs"
import path from "path"
import type { DB, ResolvedAssignment, TV } from "./types"
import { whepUrl } from "./config"

const DB_PATH = path.join(process.cwd(), "db.json")

function seed(): DB {
  const tvs: TV[] = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `TV ${i + 1}`,
    channel: i + 1,
    defaultChannel: i + 1,
    lastSeen: "",
    override: null,
  }))
  const channels = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `Canal ${i + 1}`,
    sourceType: "LIVE" as const,
    sourceUrl: "",
    mediamtxPath: `canal${i + 1}`,
  }))
  return { tvs, channels, schedule: [], users: [] }
}

let writeLock: Promise<void> = Promise.resolve()

export async function readDB(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8")
    const parsed = JSON.parse(raw) as DB
    if (!parsed.tvs || !parsed.channels) throw new Error("invalid")
    if (!parsed.schedule) parsed.schedule = []
    if (!parsed.users) parsed.users = []
    return parsed
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      const data = seed()
      await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf8")
      return data
    }
    throw err
  }
}

export async function writeDB(data: DB): Promise<void> {
  const run = writeLock.then(async () => {
    const tmpPath = DB_PATH + ".tmp"
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8")
    await fs.rename(tmpPath, DB_PATH)
  })
  writeLock = run.catch(() => {})
  return run
}

export async function updateDB<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const db = await readDB()
  const result = await fn(db)
  await writeDB(db)
  return result
}

function isActiveNow(start: string, end: string, now: Date): boolean {
  if (start && now < new Date(start)) return false
  if (end && now > new Date(end)) return false
  return true
}

export function resolveAssignment(db: DB, tvId: number): ResolvedAssignment | null {
  const tv = db.tvs.find((t) => t.id === tvId)
  if (!tv) return null
  const now = new Date()
  const active = db.schedule
    .filter((s) => s.tvIds.includes(tvId) && isActiveNow(s.startTime, s.endTime, now))
    .at(-1)
  if (active) {
    return buildResolved(db, tv, {
      sourceType: active.sourceType,
      channelId: active.channelId,
      sourceUrl: active.sourceUrl,
      content: active.content,
      bgColor: active.bgColor,
      textColor: active.textColor,
    })
  }
  if (tv.override) {
    return buildResolved(db, tv, tv.override)
  }
  const channel = db.channels.find((c) => c.id === tv.channel)
  if (!channel) return null
  return {
    tvId: tv.id,
    channel: channel.id,
    channelName: channel.name,
    sourceType: channel.sourceType,
    sourceUrl:
      channel.sourceType === "LIVE" || channel.sourceType === "VIDEO_LOOP"
        ? whepUrl(channel.mediamtxPath)
        : channel.sourceUrl,
    content: channel.content,
    bgColor: channel.bgColor,
    textColor: channel.textColor,
  }
}

function buildResolved(
  db: DB,
  tv: TV,
  o: {
    sourceType: ResolvedAssignment["sourceType"]
    channelId?: number
    sourceUrl?: string
    content?: string
    bgColor?: string
    textColor?: string
  },
): ResolvedAssignment {
  const channel = o.channelId ? db.channels.find((c) => c.id === o.channelId) : undefined
  let sourceUrl = o.sourceUrl ?? ""
  if ((o.sourceType === "LIVE" || o.sourceType === "VIDEO_LOOP") && channel) {
    sourceUrl = whepUrl(channel.mediamtxPath)
  }
  return {
    tvId: tv.id,
    channel: channel?.id ?? tv.channel,
    channelName: channel?.name ?? "Contenido RRHH",
    sourceType: o.sourceType,
    sourceUrl,
    content: o.content,
    bgColor: o.bgColor,
    textColor: o.textColor,
  }
}
