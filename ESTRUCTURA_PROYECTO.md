# Estructura del Proyecto: Sistema de Gestión IPTV

## 1. Resumen Técnico
El Sistema de Gestión IPTV es una plataforma web desarrollada en Next.js (App Router) diseñada para administrar contenido multimedia. Opera mediante un mecanismo de polling de estado para que los reproductores (TVs) consulten su asignación. Posee integración directa con MediaMTX para el consumo (WHEP) y emisión (WHIP) de streaming WebRTC.

## 2. Tecnologías y Librerías Confirmadas
- **Next.js 16 / React 19 / TypeScript** (Confirmado en `package.json`)
- **Tailwind CSS v4** (Confirmado en `package.json` y `globals.css`)
- **SWR** (Confirmado en `app/admin/admin-client.tsx`)
- **adm-zip** (Confirmado en `app/api/upload-media/route.ts` para extracción de ZIPs)
- **pdfjs-dist** (Confirmado en `app/tv/tv-client.tsx` línea ~172 para renderizado en Canvas)
- **MediaMTX / WHEP / WHIP** (Confirmado en `lib/config.ts`, `components/whep-player.tsx`, y `components/whip-broadcaster.tsx`)
- **Metered TURN/STUN** (Confirmado en `components/whip-broadcaster.tsx` línea ~128)

## 3. Arquitectura de Carpetas y Ficheros

- `app/admin/`: Interfaz para administración (`admin-client.tsx`) y configuración de canales (`sources/`).
- `app/api/assignment/`: Endpoint (`route.ts`) que resuelve el contenido para una TV y permite mutaciones manuales.
- `app/api/auth/`: Endpoint (`route.ts`) que verifica si un PIN provisto coincide con `ADMIN_PIN` o `RRHH_PIN`. Devuelve un booleano.
- `app/api/channels/`: CRUD de canales.
- `app/api/mediamtx/`: Proxy de funciones (kick publisher, status).
- `app/api/presentation-info/`: Devuelve metadatos (fecha de subida) para que la TV recargue PDFs o Imágenes.
- `app/api/reset/`: Borra overrides de TVs, restaurándolos a vivo.
- `app/api/schedule/`: CRUD de horarios para RRHH.
- `app/api/tvs/`: Endpoint de estado de TVs.
- `app/api/upload-media/`: Recibe archivos multipart (`PDF`, `VIDEO_LOOP`, `IMAGE_SLIDES`). Extrae ZIPs y guarda en disco (`public/presentations`).
- `app/api/whip-proxy/`: Proxy para redirigir peticiones WebRTC WHIP al puerto 8889 de MediaMTX.
- `app/api/upload-pdf/`: Carpeta vacía confirmada.
- `app/rrhh/`: Interfaz de Recursos Humanos.
- `app/tv/`: Reproductor final (`tv-client.tsx`). Consome Canva, WHEP, PDF, Video e Imágenes locales.
- `components/`: Componentes UI y lógica de streaming (`whep-player.tsx`, `whip-broadcaster.tsx`, `pin-gate.tsx`, `theme-provider.tsx` - sin uso confirmado).
- `lib/db.ts`: Capa de persistencia. Lee y escribe sobre `db.json` usando `fs` y un sistema de promesas encadenadas (`writeLock = run.catch(...)`).
- `public/presentations/`: Directorio donde `/api/upload-media` guarda los archivos estáticos subidos.

## 4. Módulos y Flujos Confirmados

### Persistencia (Base de Datos)
Toda la data estructurada reside en el archivo estático `db.json`. El acceso se hace a través de `lib/db.ts`. La concurrencia se intenta mitigar usando una única variable global `let writeLock: Promise<void>` que encadena las llamadas a `fs.writeFile()`. Las rutas que mutan este archivo son `/api/assignment`, `/api/schedule`, `/api/channels`, `/api/tvs`, `/api/reset`.

### Flujo de Reproducción (TV Client)
El componente principal de reproducción (`app/tv/tv-client.tsx`) ejecuta un `setInterval` cada 5 segundos realizando un `fetch` a `/api/assignment?tv={id}`. Luego, renderiza condicionalmente: `<WhepPlayer>`, `<video>`, `<CanvaSlideshow>`, `<PdfSlideshow>`, o `<ImageSlideshow>`.

### MediaMTX y WebRTC
El sistema se integra con MediaMTX de dos formas:
1. **Consumo (WHEP):** El componente `WhepPlayer` crea un `RTCPeerConnection` pasivo y envía su SDP al endpoint `/whep` configurado en `lib/config.ts`.
2. **Emisión (WHIP):** El componente `WhipBroadcaster` captura la pantalla/cámara mediante `navigator.mediaDevices.getDisplayMedia`, crea un `RTCPeerConnection` **inyectando credenciales explícitas de Metered TURN/STUN**, y publica su SDP a `/api/whip-proxy/`, que a su vez lo redirige a MediaMTX.

### Sistema de Uploads
Implementado en `app/api/upload-media/route.ts`. Funciona escribiendo directamente al disco duro del host usando `fs.writeFile` en la ruta absoluta construida con `process.cwd() + "/public/presentations"`. No hay restricciones de tamaño implementadas por código en ese archivo, solo validaciones de formato (`application/pdf`, `video/`, `application/zip`).

### Seguridad Implementada
- Autenticación visual en paneles `/admin` y `/rrhh` usando el componente `PinGate` que guarda una bandera en `localStorage` si `/api/auth` retorna ok.
- No hay ningún archivo `middleware.ts`.
- Los endpoints de la carpeta `app/api/` no validan tokens JWT, ni cookies de sesión en su código fuente actual.
