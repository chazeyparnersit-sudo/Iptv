import type { DB, ResolvedAssignment, TV } from "./types"
import { whepUrl } from "./config"
import { supabase } from "./supabase"

export async function readDB(): Promise<DB> {
  const [{ data: tvs }, { data: channels }, { data: schedule }, { data: users }] =
    await Promise.all([
      supabase.from('tvs').select('*').order('id'),
      supabase.from('channels').select('*').order('id'),
      supabase.from('schedule').select('*'),
      supabase.from('users').select('*'),
    ])
  return {
    tvs: tvs ?? [],
    channels: channels ?? [],
    schedule: schedule ?? [],
    users: users ?? [],
  }
}

export async function readAssignmentDB(): Promise<Omit<DB, "users"> & { users: [] }> {
  const [{ data: tvs }, { data: channels }, { data: schedule }] =
    await Promise.all([
      supabase.from('tvs').select('*').order('id'),
      supabase.from('channels').select('*').order('id'),
      supabase.from('schedule').select('*'),
    ])
  return {
    tvs: tvs ?? [],
    channels: channels ?? [],
    schedule: schedule ?? [],
    users: [],
  }
}

function isActiveNow(start: string, end: string, now: Date): boolean {
  if (start && now < new Date(start)) return false
  if (end && now > new Date(end)) return false
  return true
}

export function resolveAssignment(db: any, tvId: number): ResolvedAssignment | null {
  const tv = db.tvs.find((t: TV) => t.id === tvId)
  if (!tv) return null
  const now = new Date()
  const active = db.schedule
    .filter((s: any) => s.tvIds.includes(tvId) && isActiveNow(s.startTime, s.endTime, now))
    .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .at(0)
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
  const channel = db.channels.find((c: any) => c.id === tv.channel)
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

function buildResolved(db: any, tv: TV, o: any): ResolvedAssignment {
  const channel = o.channelId ? db.channels.find((c: any) => c.id === o.channelId) : undefined
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
