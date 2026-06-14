import { Suspense } from "react"
import { TvClient } from "./tv-client"

export const metadata = {
  title: "TV Player",
}

export default function TvPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-black">
          <p className="text-sm text-neutral-600">Cargando…</p>
        </div>
      }
    >
      <TvClient />
    </Suspense>
  )
}
