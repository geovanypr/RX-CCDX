# RX CCDX — Cliente web

Interfaz React 19 + Vite del sistema de gestión radiológica. Consume el API de `../server`.

## Comandos

```bash
npm install        # dependencias
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # compilación de producción en dist/
npm run preview    # sirve la compilación para revisarla
npm run lint       # oxlint
```

## Configuración

El API se resuelve en este orden: `VITE_API_URL` (definida en `.env.local`) y, si no existe,
`http://localhost:3002`. Copie `.env.example` a `.env.local` solo si su API corre en otro puerto
o en otro host.

## Estructura

- `src/components` — pantallas y modales: `Login`, `Dashboard` (encargado/super admin),
  `RadiologistView` (estación de lectura con visor PACS), `CarpetasVirtuales`, `StudyDetailModal`,
  `AdminPanel`, `CommunicationHub`/`CommunicationPanel`, `InformeViewer`, `RegisterModal`.
- `src/context` — `AuthContext` (sesión y token) y `NotificationContext` (Socket.IO, avisos y contadores).
- `src/utils` — formateadores de fecha/sexo y sonido de notificaciones.
- `src/config.js` — `API_URL` y utilidades de descarga autenticada.
- `src/index.css` — sistema de diseño completo (variables, componentes, impresión).

Las variables de sesión se guardan en `localStorage` con el prefijo `rxccdx_`.
