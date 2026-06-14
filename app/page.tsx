import Link from "next/link"
import { Monitor, Users, RadioTower, ArrowRight } from "lucide-react"

export default function Page() {
  const cards = [
    {
      href: "/admin",
      icon: Monitor,
      title: "Administración",
      desc: "Gestiona los 8 televisores, asigna canales y supervisa el estado de las transmisiones.",
      accent: "text-blue-600",
      ring: "group-hover:border-blue-300",
      pin: "PIN requerido",
    },
    {
      href: "/rrhh",
      icon: Users,
      title: "RRHH — Contenido",
      desc: "Publica anuncios, presentaciones de Canva o transmisiones en uno o todos los televisores.",
      accent: "text-emerald-600",
      ring: "group-hover:border-emerald-300",
      pin: "PIN requerido",
    },
    {
      href: "/transmitir",
      icon: RadioTower,
      title: "Transmitir",
      desc: "Comparte tu pantalla en uno o varios televisores usando tu cámara o contenido de pantalla.",
      accent: "text-purple-600",
      ring: "group-hover:border-purple-300",
      pin: "Login requerido",
    },
  ]

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col px-4 py-16 sm:py-24">
        <div className="flex items-center gap-2 text-blue-600">
          <RadioTower className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">IPTV Local</span>
        </div>
        <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Sistema de gestión multicanal
        </h1>
        <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-slate-600">
          Administra hasta 8 televisores en red local conectados a MediaMTX. Asigna canales en
          vivo, programa anuncios y controla el contenido de cada pantalla, todo sin conexión a
          internet.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md ${c.ring}`}
            >
              <c.icon className={`h-7 w-7 ${c.accent}`} />
              <h2 className="mt-4 font-semibold text-slate-900">{c.title}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500">{c.desc}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{c.pin}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-500" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          <p className="font-medium text-slate-700">Acceso rápido a televisores</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={`/tv?tv=${n}`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
              >
                TV {n}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
