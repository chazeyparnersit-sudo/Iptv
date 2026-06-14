export type SourceType = "LIVE" | "CANVA" | "ANNOUNCEMENT" | "VIDEO_LOOP" | "PDF" | "IMAGE_SLIDES"
export interface Channel {
  id: number
  name: string
  sourceType: SourceType
  sourceUrl: string
  mediamtxPath: string
  content?: string
  bgColor?: string
  textColor?: string
}
export interface Override {
  sourceType: SourceType
  channelId?: number
  sourceUrl?: string
  content?: string
  bgColor?: string
  textColor?: string
}
export interface TV {
  id: number
  name: string
  channel: number
  defaultChannel: number
  lastSeen: string
  override: Override | null
}
export interface ScheduleItem {
  id: string
  tvIds: number[]
  sourceType: SourceType
  channelId?: number
  sourceUrl?: string
  content?: string
  bgColor?: string
  textColor?: string
  startTime: string
  endTime: string
}
export type UserRole = "admin" | "rrhh" | "jefe" | "tv"
export interface User {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  name: string
  createdAt: string
}
export interface DB {
  tvs: TV[]
  channels: Channel[]
  schedule: ScheduleItem[]
  users: User[]
}
export interface ResolvedAssignment {
  tvId: number
  channel: number
  channelName: string
  sourceType: SourceType
  sourceUrl: string
  content?: string
  bgColor?: string
  textColor?: string
}
