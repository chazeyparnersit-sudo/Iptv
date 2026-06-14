import { PinGate } from "@/components/pin-gate"
import { SourcesClient } from "./sources-client"

export const metadata = {
  title: "Canales — IPTV",
}

export default function SourcesPage() {
  return (
    <PinGate panel="admin" title="Configuración de canales">
      <SourcesClient />
    </PinGate>
  )
}
