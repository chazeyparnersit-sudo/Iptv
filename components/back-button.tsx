"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function BackButton({ href = "/", label = "Volver" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}
