# RX CCDX — Sistema de Gestión Radiológica

Aplicación web para un centro de diagnóstico por imágenes: registra pacientes y estudios, controla
el flujo de las placas entre el personal administrativo y el médico radiólogo, genera el informe en
Word y deja trazabilidad completa de cada envío.

- **Cliente:** React 19 + Vite 8 (SPA en español, un solo archivo de estilos propio).
- **Servidor:** Node.js + Express 5 + better-sqlite3, con WebSockets (Socket.IO) para tiempo real.
- **Base de datos:** SQLite en `server/rxccdx.sqlite` (sin servidor externo, respaldo = copiar el archivo).
- **Generación de documentos:** `docx` crea el informe Word dentro de la carpeta del paciente.

---

## 1. Roles y flujo de trabajo

| Rol | Acceso | Puede hacer |
| --- | --- | --- |
| **ENCARGADO** (administrativo) | `/dashboard` | Registrar pacientes y estudios (con marca de urgencia), asignar placas al radiólogo, recibir diagnósticos, imprimir y entregar, devolver estudios con nota de corrección, gestionar carpetas virtuales y expedientes (editar/eliminar), ver reportes de productividad, exportar CSV y usar la mensajería. |
| **RADIOLOGO** | `/radiologo` | Lista de trabajo priorizada, tomar/iniciar estudios, visor PACS (zoom, brillo, contraste, pantalla completa), subir placas, marcar urgencia, redactar y firmar el diagnóstico con plantillas categorizadas, ver el historial clínico del paciente. |
| **SUPER_ADMIN** | Todo | Modo Fantasma: es invisible para el resto del sistema y tiene acceso a todas las pantallas, más el panel de administración (usuarios, auditoría, plantillas, parámetros del centro). |

Ciclo de vida de un estudio (máquina de estados del servidor):

```
Recibida → Pendiente de enviar al radiólogo → Enviada al radiólogo
        → Diagnóstico recibido → Listo para imprimir → Entregado
                       ↕ Devuelta por revisión (corrección solicitada al radiólogo)
```

Ciclo de entrega: las placas recibidas se agrupan y la entrega estimada se calcula para el
**miércoles siguiente** (semana radiológica miércoles → martes).

---

## 2. Requisitos

- **Node.js 20 o superior** (probado con Node 20/22) y npm.
- Windows, macOS o Linux. En Windows el proyecto se ejecuta desde **Git Bash** para los comandos `npm` del directorio raíz.
- No requiere servidor de base de datos ni servicios en la nube.

---

## 3. Instalación

```bash
# 1. Dependencias (raíz, servidor y cliente)
npm install
npm --prefix server install
npm --prefix client install

# 2. Configurar el servidor
cp server/.env.example server/.env

# 3. Configurar el cliente (solo si el API no está en http://localhost:3002)
cp client/.env.example client/.env.local

# 4. Arrancar servidor + cliente juntos
npm start
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:3002> (compruebe `http://localhost:3002/api/health`)

### Variables de entorno (`server/.env`)

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `PORT` | No (3002) | Puerto del API. |
| `JWT_SECRET` | **Sí** | Clave larga y aleatoria para firmar los tokens. El servidor **no arranca** sin ella. |
| `JWT_REFRESH_SECRET` | Recomendada | Reservada para rotación de tokens. |
| `CORS_ORIGIN` | Recomendada | Orígenes permitidos, separados por coma (`http://localhost:5173,http://127.0.0.1:5173`). |

Genere un secreto nuevo con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Crear la primera cuenta de Super Administrador

Las cuentas se crean desde el panel de administración, pero la primera debe insertarse a mano.
Con el servidor detenido, desde `server/`:

```bash
cd server
node -e "require('dotenv').config();const b=require('bcryptjs'),d=require('./db');const u=process.env.ADMIN_USER||'admin';const p=process.env.ADMIN_PASS||'CAMBIE_ESTA_CLAVE_LARGA';d.prepare('INSERT INTO usuarios (username,password_hash,role,nombre_completo) VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash').run(u,b.hashSync(p,10),'SUPER_ADMIN','Administrador del Sistema');console.log('Super admin listo:',u)"
```

> La contraseña mínima del sistema es de **10 caracteres**. Cámbiela al iniciar sesión
> (Ajustes de cuenta pide siempre la contraseña actual).

---

## 4. Scripts disponibles

| Comando (raíz) | Qué hace |
| --- | --- |
| `npm start` / `npm run dev` | Arranca servidor y cliente; reutiliza los procesos que ya estén activos. |
| `npm run server` | Solo el API. |
| `npm run server:dev` | Solo el API con recarga automática (`node --watch`). |
| `npm run client` | Solo el frontend (Vite). |
| `npm run client:build` | Compila el frontend en `client/dist`. |
| `npm run check` | Verificación de sintaxis de todos los archivos del servidor. |

---

## 5. Estructura del proyecto

```
.
├── client/                  Aplicación React
│   ├── public/              favicon.ico y logo.png servidos en la raíz
│   └── src/
│       ├── components/      Vistas y modales (Dashboard, RadiologistView, PacsViewer, …)
│       ├── context/         AuthContext y NotificationContext (sesión y tiempo real)
│       ├── utils/           Formateadores, emojis, catálogo radiológico y cliente de API
│       ├── config.js        API_URL y descargas autenticadas
│       └── index.css        Sistema de diseño completo
├── server/                  API REST + WebSockets
│   ├── index.js             Todas las rutas, Socket.IO y reglas de negocio
│   ├── db.js                Esquema SQLite, índices y parámetros por defecto
│   ├── fs_manager.js        Carpetas de pacientes y exportación al escritorio
│   ├── word_generator.js    Informe Word (.docx) con membrete del centro
│   ├── middleware/auth.js   Verificación de JWT y control de roles
│   └── data/                Carpetas de pacientes y archivos de comunicación
├── marca/                   Logos originales entregados por el centro
└── scripts/dev.js           Arranque conjunto de servidor y cliente
```

---

## 6. API principal

Todas las rutas (salvo `/api/health`, `/api/auth/login` y la recuperación de contraseña) requieren
la cabecera `Authorization: Bearer <token>`. Los archivos privados aceptan además `?token=` porque
las etiquetas de imagen del navegador no pueden enviar cabeceras.

| Área | Endpoints |
| --- | --- |
| Autenticación | `POST /api/auth/login`, `POST /api/auth/register`, `GET/POST /api/auth/recover`, `PUT /api/usuarios/me` |
| Pacientes | `GET/POST /api/pacientes`, `PUT/DELETE /api/pacientes/:id`, `GET /api/pacientes/buscar`, `GET /api/pacientes/por-registro/:registro_id`, `GET /api/pacientes/:id/estudios`, `POST /api/registrar`, `GET /api/next-registro-id` |
| Estudios | `GET/POST /api/estudios`, `GET/DELETE /api/estudios/:id`, `PUT /api/estudios/:id/estado`, `PUT /api/estudios/:id/urgente`, `POST /api/estudios/:id/tomar`, `POST /api/estudios/:id/diagnostico`, `PUT /api/estudios/:id/diagnostico`, `PUT /api/estudios/:id/devolver`, `POST /api/estudios/lote/entregar` |
| Archivos | `GET /api/estudios/:id/archivos`, `POST /api/estudios/:id/upload`, `POST /api/estudios/:id/enviar-placas`, `DELETE /api/estudios/:id/archivos/:filename`, `GET /api/estudios/:id/export`, `POST /api/estudios/:id/export-desktop` |
| Descargas | `GET /api/estudios/:id/archivos/:filename/download`, `GET /api/estudios/:id/radiografias/download` (ZIP de placas), `GET /api/pacientes/:id/archivos/:filename/download`, `GET /api/pacientes/:id/radiografias/download` (ZIP del expediente), `GET /api/estudios/:id/informe/download`, `GET /api/carpetas/:paciente_id/download` |
| Informe | `GET /api/estudios/:id/informe/preview`, `GET /api/estudios/:id/informe/download` |
| Carpetas | `GET /api/carpetas`, `GET /api/carpetas/:paciente_id`, `GET /api/carpetas/:paciente_id/download` |
| Comunicación | `GET/POST /api/comunicacion/mensajes`, `POST /api/comunicacion/archivos`, `GET /api/comunicacion/archivos/:filename`, `GET/POST /api/estudios/:id/mensaje(s)` |
| Administración | `GET/PUT /api/config`, `GET /api/usuarios`, `PUT /api/usuarios/:id/activo`, `PUT /api/usuarios/:id/password`, `GET /api/auditoria`, `GET/POST/PUT/DELETE /api/plantillas` |
| Métricas | `GET /api/stats`, `GET /api/stats/por-estado`, `GET /api/reportes/mensual`, `GET /api/reportes/top-estudios`, `GET /api/reportes/productividad`, `GET /api/calendario/entregas` |

Eventos Socket.IO en tiempo real: `estudio:nuevo`, `estudio:enviado`, `estudio:tomado`,
`estudio:devuelto`, `estudio:eliminado`, `diagnostico:recibido`, `diagnostico:corregido`,
`archivo:subido`, `placas:enviadas`, `mensaje:nuevo`, `comunicacion:nuevo`.

---

## 7. Capacidades de la interfaz

- **Visor radiológico tipo PACS:** zoom con rueda (centrado en el cursor), desplazamiento, ventana de brillo/contraste
  con preajustes (óseo, pulmón, partes blandas), inversión de negativo, rotación, regla de medición, pantalla
  completa y descarga de la placa. Está disponible para el radiólogo (con navegación entre placas con las flechas
  del teclado) y para el encargado al abrir cualquier estudio.
- **Descarga de radiografías:** cada placa se descarga individualmente y el estudio o el expediente completo en un
  ZIP (`Descargar placas (n)` y `Radiografías (n)`), con registro de auditoría de cada descarga.
- **Comparación con el estudio previo:** el radiólogo puede ver la placa actual y la del estudio anterior del mismo
  paciente lado a lado, cada una con su propio zoom y ventana.
- **Catálogo radiológico y región anatómica:** el registro de placas ofrece 30 estudios típicos organizados por región
  (tórax, abdomen, columna, extremidades, cráneo…), la región se completa sola según el tipo elegido, se guarda con
  el estudio, aparece en el informe Word y alimenta el filtro del panel y los reportes por región.
- **Plantillas sugeridas por región:** al redactar, el selector muestra primero las plantillas de la categoría
  correspondiente al estudio.
- **Mensajería con emojis:** los tres canales de chat (panel por estudio, mensajería general y detalle del
  estudio) incluyen un selector de emojis sin dependencias externas, con pestañas por categoría
  (frecuentes, caras, gestos, clínico, objetos), buscador por palabras clave y memoria de los últimos 24 usados.
- **Estudios urgentes:** se marcan al registrar la placa (o después, desde el detalle o la estación de lectura),
  encabezan la bandeja de trabajo y el panel avisa cuántos siguen sin entregar.
- **Reportes de productividad:** KPIs del período, productividad por radiólogo con tiempo medio de lectura
  (del envío de placas al informe firmado), médicos remitentes más frecuentes, producción por región anatómica con
  urgentes, entregas vencidas y exportación a CSV.
- **Filtros de la bandeja:** por tipo de estudio, región anatómica y rango de fechas, además del filtro de urgentes;
  la exportación CSV respeta los filtros activos.
- **Centro de notificaciones:** los avisos en tiempo real ya no se pierden al desaparecer el toast; quedan
  listados por sesión en la campana, con opción de limpiarlos.
- **Plantillas de diagnóstico:** categorizables desde el panel de administración y filtrables por nombre, texto
  o categoría desde el editor del radiólogo.
- **Expedientes de pacientes:** edición de teléfono, correo, dirección y notas, además de eliminación completa
  (estudios, mensajes y archivos) con confirmación.
- **Exportaciones CSV:** la bandeja de estados activa y el registro de auditoría se descargan directamente para Excel.
- **Seguimiento de entregas:** cada fila muestra la fecha estimada de entrega, resaltada en rojo cuando el ciclo se venció.
- **Atajos de teclado:** `Ctrl+K` enfoca la búsqueda de placas, `Ctrl+Enter` firma el informe en la estación de lectura.
- **Sesión protegida:** si el token caduca, el sistema cierra la sesión y vuelve al login explicando el motivo.
- **Arranque rápido:** las vistas pesadas (carpetas, reportes, panel de administración, modal de estudio y visor
  de informes) se descargan solo cuando se abren, reduciendo el paquete inicial de 500 kB a ~400 kB.
- **Migraciones automáticas:** al arrancar, el servidor agrega las columnas nuevas a bases de datos antiguas,
  de modo que actualizar el sistema nunca exige reinstalar ni perder información.

---

## 8. Seguridad implementada

- Contraseñas con bcrypt (10 rondas) y políticas de longitud mínima en registro, recuperación y cambio.
- JWT firmado con `JWT_SECRET` (12 h), validado en cada petición y re-verificando que la cuenta siga activa.
- Control de roles por endpoint; el SUPER_ADMIN pasa la verificación por diseño (Modo Fantasma).
- Límite de intentos en login (10 cada 15 min por IP + usuario) y en registro/recuperación.
- Cabeceras de seguridad, CORS restringido por `CORS_ORIGIN`, `x-powered-by` desactivado.
- Validación de tipo y extensión real de archivos subidos (multer), límite de 50 MB y protección contra path traversal.
- Auditoría de accesos y acciones sensibles (login, cambios de estado, descargas, borrados, cambios de credenciales).
- Los radiólogos solo acceden a los estudios que les corresponden.

---

## 9. Operación y respaldos

1. **Respaldo diario:** copie `server/rxccdx.sqlite` (junto con `-wal` y `-shm`, o detenga el servidor
   primero) y la carpeta `server/data/`. Con eso el sistema se restaura por completo.
2. **Puesta en producción:**
   ```bash
   npm --prefix client run build      # genera client/dist
   npm --prefix server start          # API en el puerto definido en server/.env
   ```
   Sirva `client/dist` con el servidor web del centro (IIS, Nginx o Apache) apuntando al API y
   agregue el dominio real en `CORS_ORIGIN`.

---

## 10. Notas de entrega

- La base de datos se entrega **sin datos clínicos**: se eliminaron los pacientes, estudios, mensajes,
  plantillas y registros de auditoría de prueba, y se reiniciaron los contadores de ID.
- Las cuentas existentes (`ghost_master`, `radiologo`, `encargado`) y los parámetros del centro
  (nombre, dirección, teléfono, correo, pie de informe) se conservan tal como quedaron configurados.
- `server/.env` contiene el secreto real y **no está incluido en el repositorio** (`.gitignore`);
  entregue ese archivo por un canal seguro o genere uno nuevo.
- Los logos originales están en `marca/`; la aplicación usa `client/public/favicon.ico` y
  `client/public/logo.png`.
- Se corrigieron además: permisos del Super Administrador en todas las operaciones, desfases de fecha por
  zona horaria en entregas y reportes, validación de contraseñas en recuperación y cambios de credenciales,
  creación de plantillas (chave foránea `creado_por`) y columnas faltantes en bases antiguas
  (`plantillas.categoria`, `pacientes.direccion/correo/notas`, `auditoria.ip`).
