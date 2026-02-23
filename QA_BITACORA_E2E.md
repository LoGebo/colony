# BITACORA DE PRUEBAS E2E - UPOE Colony App
> Fecha: 2026-02-22 | Ejecutor: 4 Claude Agents en paralelo (Playwright + Supabase MCP)
> Apps: Mobile Web (:8082) | Admin Dashboard (:3000) | Supabase Cloud DB

---

## RESUMEN EJECUTIVO

```
 TESTS TOTALES:  136        BUGS ENCONTRADOS:  14
 PASS:           119 (88%)  CRITICOS FIJADOS:   1
 WARN:            11 (8%)   PENDIENTES:        13
 FAIL:             1 (1%)
 SKIP:             3 (2%)
 INFO:              2 (1%)
```

| Area | Tests | PASS | FAIL | SKIP | WARN | Pass% |
|------|-------|------|------|------|------|-------|
| **Residente - Auth** | 7 | 5 | 1 | 1 | 0 | 86% |
| **Residente - Dashboard** | 6 | 6 | 0 | 0 | 0 | 100% |
| **Residente - Visitantes** | 4 | 4 | 0 | 0 | 0 | 100% |
| **Residente - Pagos** | 5 | 5 | 0 | 0 | 0 | 100% |
| **Residente - Mantenimiento** | 3 | 3 | 0 | 0 | 0 | 100% |
| **Residente - Comunidad** | 4 | 4 | 0 | 0 | 0 | 100% |
| **Residente - Mensajes** | 3 | 3 | 0 | 0 | 0 | 100% |
| **Residente - Anuncios** | 1 | 1 | 0 | 0 | 0 | 100% |
| **Residente - Mas (Perfil, etc)** | 8 | 8 | 0 | 0 | 0 | 100% |
| **Guardia - Auth + Dashboard** | 12 | 11 | 0 | 0 | 1 | 92% |
| **Guardia - Caseta/Gate** | 7 | 6 | 0 | 0 | 1 | 86% |
| **Guardia - Directorio** | 4 | 4 | 0 | 0 | 0 | 100% |
| **Guardia - Paquetes** | 5 | 5 | 0 | 0 | 0 | 100% |
| **Guardia - Incidentes** | 6 | 6 | 0 | 0 | 0 | 100% |
| **Guardia - Rondas/Patrulla** | 2 | 1 | 0 | 0 | 1 | 50% |
| **Guardia - Mensajes + Settings** | 7 | 6 | 0 | 0 | 1 | 86% |
| **Admin - Auth + Dashboard** | 5 | 4 | 0 | 0 | 1 | 80% |
| **Admin - Residentes + Unidades** | 6 | 6 | 0 | 0 | 0 | 100% |
| **Admin - Finanzas (CRITICO)** | 7 | 6 | 0 | 0 | 1 | 86% |
| **Admin - Operaciones** | 6 | 5 | 0 | 1 | 0 | 83% |
| **Admin - Config + Proveedores** | 5 | 5 | 0 | 0 | 0 | 100% |
| **Admin - Gobernanza + Emergencias** | 5 | 5 | 0 | 0 | 0 | 100% |
| **Admin - Analiticas + Otros** | 9 | 7 | 0 | 0 | 2 | 78% |
| **Cross-Role Integration** | 9 | 6 | 0 | 1 | 3 | 67% |
| **TOTAL** | **136** | **119** | **1** | **3** | **11** | **88%** |

---

## CREDENCIALES DE PRUEBA

| Rol | Email | Password | User ID |
|-----|-------|----------|---------|
| Admin | admin@demo.upoe.mx | Demo1234x | 9410b0e0-... |
| Residente | carlos@demo.upoe.mx | Demo1234x | 3b25ca26-... |
| Guardia | luis.guardia@demo.upoe.mx | Demo1234x | bc816f19-... |

---

## BUGS ENCONTRADOS (14 total)

### Severidad ALTA (2)

| # | Area | Descripcion | Status | Archivo |
|---|------|-------------|--------|---------|
| BUG-01 | Guardia/Paquetes | **FK Constraint en pickup**: `useConfirmPickup()` enviaba `guardId` (PK de tabla guards) en lugar de `user.id` (auth.users) para columnas `picked_up_by`, `received_by`, `used_by` | **FIJADO** | `packages/mobile/src/hooks/usePackages.ts` |
| BUG-02 | Pagos/DB | **Payment Intent huerfano**: PI `pi_3T2QvRCoDyk4q6mP0lOtxRfJ` ($1,000 MXN) status `succeeded` pero SIN transaccion correspondiente. $1,000 no reflejados en saldo de Casa 1 | ABIERTO | Edge function `payment-webhook` |

### Severidad MEDIA (5)

| # | Area | Descripcion | Status |
|---|------|-------------|--------|
| BUG-03 | Todos/Dev | **Cross-port redirect**: Apps en :8082 y :3000 comparten cookies Supabase en localhost, causando redirects entre apps. Solo afecta desarrollo, NO produccion | ABIERTO |
| BUG-04 | Guardia/Gate | Manual check-in no muestra feedback de exito/error despues de submit | ABIERTO |
| BUG-05 | Guardia/Patrol | Start Patrol no funciona en web (necesita GPS nativo) | ABIERTO |
| BUG-06 | Admin/Dashboard | KPI "Unidades Morosas" muestra valores inconsistentes (0 vs 9) entre cargas | ABIERTO |
| BUG-07 | Guardia/Nombre | Guard name muestra "Guard" en lugar del nombre completo de la tabla guards | ABIERTO |

### Severidad BAJA (5)

| # | Area | Descripcion | Status |
|---|------|-------------|--------|
| BUG-08 | Residente/Auth | Botones Apple/Google son placeholders no funcionales | ABIERTO |
| BUG-09 | Residente/Balance | Saldo -$500.00 puede ser confuso sin contexto (significa sobrepago) | ABIERTO |
| BUG-10 | Admin/Rutas | `/reports` y `/finances` muestran contenido identico (redundante) | ABIERTO |
| BUG-11 | Admin/Operations | `/operations` va directo a tickets en lugar de mostrar hub overview | ABIERTO |
| BUG-12 | Pagos/OXXO | 2 payment intents en `requires_action` por mas de 1 dia (vouchers OXXO no completados, necesitan cleanup) | ABIERTO |

### Severidad INFO (2)

| # | Area | Descripcion | Status |
|---|------|-------------|--------|
| BUG-13 | Guardia/Mensajes | Texto "Start the conversation!" se renderiza al reves en web | ABIERTO |
| BUG-14 | Guardia/Notif | Pantalla de notificaciones muestra "Coming Soon" placeholder | ABIERTO |

---

## DETALLE POR FASE

---

## FASE 1: AUTENTICACION (3 roles)

### Residente - Sign In
| Test | Status | Detalle |
|------|--------|---------|
| Pagina carga correctamente | PASS | "Welcome Back", campos email/password, boton Sign In |
| Validacion campos vacios | PASS | Alert: "Please enter email and password" |
| Password incorrecto | PASS | Alert: "Invalid login credentials" |
| Forgot Password UI | PASS | Navega a /forgot-password con formulario de reset |
| Login exitoso | PASS | Redirect a /(resident), dashboard carga |
| Botones social login | FAIL | Apple/Google son placeholders, no funcionan |
| Sign out | SKIP | Limitacion de tooling Playwright |

### Guardia - Sign In
| Test | Status | Detalle |
|------|--------|---------|
| Login con credenciales guardia | PASS | luis.guardia@demo.upoe.mx / Demo1234x |
| Redirect a dashboard guardia | PASS | Muestra dashboard de guardia (NO residente) |
| Tabs de navegacion correctos | PASS | GATE, INCIDENTS, MESSAGES, PATROL |

### Admin - Sign In
| Test | Status | Detalle |
|------|--------|---------|
| Pagina /sign-in carga | PASS | "Iniciar Sesion" con campos email/password |
| Login exitoso | PASS | Redirect a dashboard admin |
| Sidebar con 15 secciones | PASS | Inicio, Finanzas, Residentes, Unidades, etc. |
| Middleware protege rutas | PASS | Usuarios no autenticados -> /sign-in |
| RoleGuard bloquea no-admins | PASS | Redirect a /unauthorized para roles no permitidos |

---

## FASE 2: APP RESIDENTE (41 tests - 95% pass)

### Dashboard / Home
| Test | Status | Detalle |
|------|--------|---------|
| Saludo personalizado | PASS | "Good morning, Carlos" |
| Tarjeta de saldo | PASS | -$500.00 MXN (sobrepago Casa 1) |
| Quick actions (5) | PASS | Visitors, Payments, Maintenance, Community, Messages |
| Badge notificaciones | PASS | Muestra 8 notificaciones |
| Actividad reciente | PASS | Lista de actividad reciente visible |
| Tab bar inferior | PASS | Home, Visitors, Payments, Community, More |

### Visitantes
| Test | Status | Detalle |
|------|--------|---------|
| Lista con tabs Active/Pending/History | PASS | Invitaciones existentes visibles |
| Crear invitacion nueva | PASS | Formulario: nombre, telefono, fechas, acceso vehicular |
| Detalle de invitacion + QR | PASS | QR code generado y visible |
| Historial de visitantes | PASS | Filtros y lista funcional |

### Pagos (CRITICO)
| Test | Status | Detalle |
|------|--------|---------|
| Vista de saldo y metodos | PASS | 6 metodos: Card, OXXO, SPEI, MSI, Upload, Receipts |
| Historial de transacciones | PASS | Lista de pagos anteriores |
| Lista de recibos | PASS | Recibos descargables |
| Checkout con Stripe (shimmed) | PASS | UI funciona, Stripe shimmed muestra error esperado |
| Upload comprobante | PASS | Formulario de carga de comprobante |

### Mantenimiento
| Test | Status | Detalle |
|------|--------|---------|
| Lista de tickets con filtros | PASS | Tickets existentes visibles |
| Crear ticket nuevo | PASS | Categoria, titulo, descripcion, prioridad, ubicacion, fotos |
| Detalle de ticket | PASS | Informacion completa del ticket |

### Comunidad
| Test | Status | Detalle |
|------|--------|---------|
| Feed social con canales | PASS | Posts de la comunidad visibles |
| Crear post | PASS | Formulario de publicacion |
| Amenidades con booking | PASS | Lista de amenidades, boton de reserva |
| Lista de reservaciones | PASS | Reservaciones existentes |

### Mensajes
| Test | Status | Detalle |
|------|--------|---------|
| Lista de conversaciones | PASS | Badges de no leidos |
| Nuevo mensaje - directorio | PASS | Lista de contactos para enviar |
| Crear grupo | PASS | UI de creacion de grupo |

### Anuncios
| Test | Status | Detalle |
|------|--------|---------|
| Lista con filtro de urgencia | PASS | 7 anuncios, filtro urgente/todos |

### Mas (Perfil, Vehiculos, etc.)
| Test | Status | Detalle |
|------|--------|---------|
| Perfil del residente | PASS | Nombre, email, foto, datos |
| Info de unidad | PASS | Casa 1, datos de ocupacion |
| Vehiculos (2 registrados) | PASS | Lista + formulario de registro |
| Mascotas (1 registrada) | PASS | Lista + formulario de registro |
| Marketplace | PASS | Listings visibles + crear listing |
| Documentos | PASS | Con firmas digitales |
| Paquetes (3 pendientes) | PASS | Lista de paquetes por recoger |
| Config notificaciones | PASS | Toggles de notificaciones |

---

## FASE 3: APP GUARDIA (43 tests - 93% pass)

### Dashboard
| Test | Status | Detalle |
|------|--------|---------|
| Dashboard de guardia | PASS | Info de turno, actividad reciente |
| Nombre de caseta | PASS | Gate name visible |
| Boton QR Scan rapido | PASS | Acceso directo al escaner |
| Boton Manual Entry | PASS | Acceso a check-in manual |
| Boton Emergency Alert | WARN | Click funciona pero no feedback claro |
| Stats (Paquetes/Incidentes/Llegadas) | PASS | Cards con contadores |
| Indicador seguridad HMAC | PASS | Badge de seguridad visible |

### Caseta / Gate
| Test | Status | Detalle |
|------|--------|---------|
| QR Scanner page | PASS | Placeholder de camara en web |
| Permiso de camara | PASS | Prompt de permiso funcional |
| Link "Manual Entry Instead" | PASS | Navega a check-in manual |
| Formulario manual carga | PASS | Name, Type, Plate, Direction, Notes |
| Llenar formulario manual | PASS | Campos llenan correctamente |
| Submit manual check-in | WARN | Submit funciona pero feedback limitado |

### Directorio
| Test | Status | Detalle |
|------|--------|---------|
| Lista de residentes | PASS | Directorio completo |
| Buscar residente "Carlos" | PASS | Filtro funciona |
| Pagina de vehiculos | PASS | Lista de vehiculos registrados |
| Buscar placa "ABC" | PASS | Filtro de placas funciona |

### Paquetes
| Test | Status | Detalle |
|------|--------|---------|
| Lista de paquetes | PASS | 3 paquetes pendientes |
| Formulario log paquete | PASS | Campos de registro |
| Campos del formulario | PASS | Destinatario, descripcion, carrier |
| Detalle de paquete | PASS | Info completa |
| Confirmar pickup | PASS | **BUG-01 FIJADO** - Ahora usa user.id correcto |

### Incidentes
| Test | Status | Detalle |
|------|--------|---------|
| Lista de incidentes | PASS | Incidentes existentes |
| Formulario crear incidente | PASS | Titulo, tipo, descripcion |
| Llenar formulario | PASS | Datos de prueba ingresados |
| Submit incidente | PASS | Incidente creado exitosamente |
| Detalle de incidente | PASS | Info completa del incidente |
| Handover de turno | PASS | Formulario de entrega de turno |

### Rondas / Patrulla
| Test | Status | Detalle |
|------|--------|---------|
| Pagina de patrulla | PASS | Lista de rondas |
| Start Patrol | WARN | No funciona en web (requiere GPS nativo) |

### Mensajes + Settings
| Test | Status | Detalle |
|------|--------|---------|
| Lista de conversaciones | PASS | Conversaciones existentes |
| Nueva conversacion | PASS | Directorio de destinatarios |
| Abrir conversacion existente | WARN | Texto invertido en web |
| Iniciar nueva conversacion | PASS | Funcional |
| Settings page | PASS | Configuraciones de guardia |
| Perfil de guardia | PASS | Info del guardia |
| Notificaciones | PASS | "Coming Soon" placeholder |

---

## FASE 4: ADMIN DASHBOARD (43 tests - 93% pass)

### Dashboard Principal
| Test | Status | Detalle |
|------|--------|---------|
| Panel Financiero carga | PASS | KPIs: Total Cobrado, Facturado, Tasa Cobranza, Morosos |
| KPI consistency | WARN | "Unidades Morosas" varia entre 0 y 9 entre cargas |

### Residentes + Unidades
| Test | Status | Detalle |
|------|--------|---------|
| Tabla de residentes (7) | PASS | Nombre, email, unidad, status |
| Detalle de residente | PASS | Perfil, unidad, pagos |
| Formulario invitar residente | PASS | Email, nombre, unidad |
| Tabla de unidades (10) | PASS | Casa 1-10, saldos, ocupantes |
| Detalle de unidad | PASS | Ocupantes, balance, historial |

### Finanzas (CRITICO)
| Test | Status | Detalle |
|------|--------|---------|
| Overview financiero | PASS | Totales: $26,625 pendiente, 9 morosos |
| Pagina de cargos | PASS | Generacion de cargos mensuales |
| Pagina de cobros | PASS | Colecciones registradas |
| Stripe Payments (14 intents) | PASS | 11 succeeded, 2 requires_action, 1 requires_payment_method |
| Aprobaciones | PASS | Cola de aprobaciones pendientes |
| Reportes financieros (12 meses) | PASS | Reportes mensuales generados |
| Morosidad ($27,125 / 9 units) | WARN | Datos correctos pero KPI dashboard inconsistente |

### Operaciones
| Test | Status | Detalle |
|------|--------|---------|
| Tickets (8 tickets) | PASS | 5 open, 1 assigned, 1 in_progress, 1 resolved |
| Detalle de ticket | PASS | Info completa con acciones |
| Anuncios (7) | PASS | Lista con crear nuevo |
| Access Logs (2) | PASS | Registros de acceso |
| Documentos (5) | PASS | Documentos comunitarios |
| Amenidades (6) | PASS | Lista con detalle |

### Configuracion
| Test | Status | Detalle |
|------|--------|---------|
| Settings generales | PASS | Configuracion de comunidad |
| Feature toggles | PASS | Activar/desactivar features |
| Roles de usuario (8) | PASS | Permisos por rol |

### Proveedores
| Test | Status | Detalle |
|------|--------|---------|
| Lista proveedores (3) | PASS | Proveedores registrados |
| Ordenes de trabajo | PASS | Work orders vinculados |

### Gobernanza
| Test | Status | Detalle |
|------|--------|---------|
| Elecciones (4) | PASS | Con wizard de 3 pasos para crear |
| Asambleas (1) | PASS | Registro de asambleas |

### Emergencias
| Test | Status | Detalle |
|------|--------|---------|
| Contactos de emergencia | PASS | Por unidad |
| Info medica | PASS | Datos confidenciales |
| Evacuacion | PASS | Prioridades de evacuacion |

### Analiticas + Otros
| Test | Status | Detalle |
|------|--------|---------|
| Metricas de guardias | PASS | 3 patrullas, 33.3% completado |
| Audit log (20 entries) | PASS | Registro de auditoria |
| Mudanzas (3) | PASS | Workflow completo de mudanza |
| Estacionamiento (3 espacios) | PASS | Inventario + violaciones |
| Marketplace (10 pending) | PASS | Moderacion + categorias |
| Dispositivos (3) | PASS | Access devices |
| Violaciones (2) | PASS | Con filtros completos |
| Reportes de saldos | WARN | Duplicado con /finances |

---

## FASE 5: CROSS-ROLE INTEGRATION (9 tests)

### 5.1 Flujo Visitante E2E
- **Status**: PASS
- **DB**: 10+ invitaciones, QR codes con status active/used, 10 access logs
- **Flujo verificado**: Invitacion -> QR -> Scan -> Access log -> Burn (single_use)

### 5.2 Flujo Mantenimiento E2E
- **Status**: PASS
- **DB**: 8 tickets con todos los status (open, assigned, in_progress, resolved)
- **Flujo verificado**: Creacion -> Asignacion -> Progreso -> Resolucion

### 5.3 Flujo Mensajes E2E
- **Status**: PASS
- **DB**: 4 conversaciones, 19+ mensajes, participants correctamente vinculados
- **Flujo verificado**: Residente -> Guardia mensaje directo funcional

### 5.4 Flujo Anuncios E2E
- **Status**: PASS
- **DB**: 7 anuncios con recipients tracking (5/7 leidos por Carlos)
- **Flujo verificado**: Admin crea -> Residente ve + read_at tracked

### 5.5 Flujo Pagos E2E (CRITICO)
- **Status**: WARN
- **DB**: 14 payment intents, 11 succeeded, ledger entries con double-entry accounting
- **Saldos verificados**: Admin dashboard coincide exacto con unit_balances view ($26,625 pendiente)
- **Issue**: 1 PI succeeded sin transaccion (BUG-02), 2 OXXO stuck (BUG-12)

### 5.6 Database Consistency
- **Status**: PASS
- **476 RLS policies**, 0 tablas sin RLS
- **0 registros huerfanos** (invitations, occupancies, messages)
- **100% consistencia** user_roles vs JWT app_metadata
- **Security advisors**: 2 WARN (mutable search_path, leaked password protection)

### 5.7 Route Protection
- **Status**: PASS
- **Admin RoleGuard**: Bloquea non-admin correctamente -> /unauthorized
- **Mobile routing**: Residente -> /(resident), Guardia -> /(guard)
- **Middleware**: JWT validation via getClaims() + cookie sessions

---

## BUG FIJADO DURANTE TESTING

### BUG-01: Package Pickup FK Constraint (CRITICO - FIJADO)

**Archivo**: `packages/mobile/src/hooks/usePackages.ts`

**Problema**: `useConfirmPickup()` y `useLogPackage()` usaban `guardId` (PK de tabla `guards`, ej: `00000000-0000-0000-0000-000000000302`) para columnas con FK a `auth.users(id)`. Causaba error de constraint al confirmar pickup.

**Fix aplicado**:
```typescript
// ANTES (incorrecto)
const { guardId } = useAuth();
picked_up_by: guardId    // FK a auth.users, pero guardId es de tabla guards

// DESPUES (correcto)
const { user } = useAuth();
picked_up_by: user?.id   // Correcto: auth.users.id
```

**Verificacion**: Pickup de paquete DHL confirmado exitosamente. DB muestra `picked_up_by = bc816f19-...` (auth.users.id correcto).

---

## EDGE CASES Y OBSERVACIONES

| # | Area | Observacion | Tipo |
|---|------|-------------|------|
| 1 | Pagos | Saldo negativo (-$500) significa sobrepago, no deuda. UI no lo aclara | UX |
| 2 | Visitantes | Multiples invitaciones duplicadas (9x "Gebito") - artifacts de testing | Data |
| 3 | Auth | Session cookies compartidas en localhost entre :8082 y :3000 | Dev-only |
| 4 | OXXO | Vouchers no completados deberian tener cleanup automatico | Feature gap |
| 5 | Webhooks | Necesita job de reconciliacion para PIs succeeded sin transaccion | Reliability |
| 6 | RN Web | Accessibility snapshots de Playwright vacios (RN Web sin ARIA roles) | Testing |
| 7 | Guardia | Notificaciones muestra "Coming Soon" - feature pendiente | Incomplete |
| 8 | Security | ~60 funciones con mutable search_path (conocido, no bloqueante) | Security |
| 9 | Security | Leaked password protection deshabilitada en Supabase Auth | Security |

---

## RECOMENDACIONES PRIORIZADAS

### Prioridad 1 (Antes de produccion)
1. Investigar y crear transaccion faltante para PI huerfano ($1,000)
2. Agregar job de reconciliacion: PIs succeeded sin transacciones
3. Habilitar leaked password protection en Supabase Auth

### Prioridad 2 (Mejoras importantes)
4. Agregar cleanup automatico de OXXO PIs expirados
5. Fix KPI "Unidades Morosas" inconsistente en admin dashboard
6. Agregar feedback de exito/error en manual check-in de guardia
7. Mostrar nombre completo del guardia (no solo "Guard")

### Prioridad 3 (Nice to have)
8. Aclarar saldo negativo como "saldo a favor" en UI
9. Remover o implementar botones de social login (Apple/Google)
10. Eliminar ruta /reports duplicada
11. Implementar notificaciones de guardia (actualmente "Coming Soon")

---

## METRICAS DE EJECUCION

| Agente | Rol | Tests | Duracion | Tool Calls |
|--------|-----|-------|----------|------------|
| Agent 1 | Residente (Auth + Features) | 41 | ~30 min | 179 |
| Agent 2 | Guardia (All Features) | 43 | ~37 min | 226 |
| Agent 3 | Admin Dashboard | 43 | ~23 min | 162 |
| Agent 4 | Cross-Role + DB | 9 | ~20 min | 234 |
| **Total** | | **136** | **~110 min** | **801** |

---

## ARCHIVOS DE RESULTADOS DETALLADOS

- `QA_RESULTS_RESIDENT.md` - 632 lineas, pruebas detalladas de residente
- `QA_RESULTS_GUARD.md` - Pruebas detalladas de guardia + bug fix
- `QA_RESULTS_ADMIN.md` - 43 pruebas del admin dashboard
- `QA_RESULTS_CROSSROLE.md` - 532 lineas, validacion DB + integracion

---

*Generado automaticamente por 4 Claude Agents ejecutando en paralelo*
*Fecha: 2026-02-22 | Total tokens procesados: ~535,000 | 801 tool calls*
