# API Improvements

Basado en `docs/API_AUDIT.md`. Cada fila es una mejora candidata para el backend
`NexaBank API` (`/home/danidev/Documentos/Dev/NexaBank API/NexaBank-Backend/nexabank/nexabank-api`).
Clasificación de riesgo según las reglas de ejecución del asistente: cualquier cambio que toque
**autenticación, dinero, cifrado/hash o sea una migración/breaking change** se marca como **Alto** y
requiere confirmación explícita por ítem antes de aplicarse, aun si no rompe el contrato HTTP.

## Tabla priorizada

| # | Mejora | Prioridad | Rompe contrato | Riesgo | Tier |
|---|---|---|---|---|---|
| 1 | springdoc-openapi (`/v3/api-docs`, `/swagger-ui`) | Alta | No | Bajo | A |
| 2 | Quitar `ex.getMessage()` del handler 500 genérico (no filtrar texto interno) | Media | No | Bajo | A |
| 3 | `@ExceptionHandler` para `InvalidCurrencyException`/`UnsupportedCurrencyException`/`QuoteExpiredException` | Media | No | Bajo | A |
| 4 | Agregar `@Valid` faltante (`AccountController`, `TransactionController`, `BeneficiaryController`, `UserController`) | Media | No* | Bajo | A |
| 5 | Validar `PinSetupRequest`/`PinVerifyRequest`/`QrPayRequest` (longitud, dígitos, `@Valid`) | Media | No* | Bajo | A |
| 6 | Quitar log de OTP en claro (`AuthService.java:77`) | Baja | No | Bajo | A |
| 7 | IDs con verificación de unicidad en vez de `Math.random()` puro | Baja | No | Bajo | A |
| 8 | Paginación por cursor real en `/transactions` (mantener `page`/`size` como alias) | Media | No | Bajo-Medio | A |
| 9 | Base de rate limiting (Bucket4j) en `/auth/*`, `/transfers`, `/qr/pay` | Media | No | Medio | A |
| 10 | `/actuator/health` + logging estructurado JSON | Baja | No | Bajo | A |
| 11 | Prefijo `/api/v1` | — | — | — | Ya cumplido, no aplica |
| 12 | **Forzar autorización real en Spring Security** (quitar `anyRequest().permitAll()`) | **Alta** | Posible** | **Alto** | B |
| 13 | **IDOR**: validar ownership en `GET /transactions/{id}` y `GET /transfers/{id}` | **Alta** | No | **Alto** | B |
| 14 | **Hashear PIN** (bcrypt/argon2) + migración de PINs existentes | **Alta** | Sí (requiere migración) | **Crítico** | B |
| 15 | **Transacciones Firestore (`runTransaction`)** en `QrService.processQrPayment` y `TransactionService.createTransaction` | **Alta** | No | **Alto** | B |
| 16 | **Dinero: persistir en Firestore como `String` decimal o entero en centavos** (no `double`) | **Alta** | No al contrato HTTP, sí a los datos ya sembrados | **Alto** | B |
| 17 | **Errores RFC 9457 Problem Details** (`application/problem+json`) | Alta | **Sí** (cambia forma de `ErrorResponse`) | **Alto** | B |
| 18 | **CORS por perfil** (separar `application-dev`/`application-prod`, quitar combinación `*` + `allowCredentials(true)`) | Media | Posible | **Alto** | B |
| 19 | **Cerrar `/api/v1/seed` y `/api/v1/seed/purge`** (auth real o solo perfil `dev`) | Alta | Posible (si algo depende de llamarlos sin token) | **Alto** | B |
| 20 | **Rol ADMIN real** (`@PreAuthorize("hasRole('ADMIN')")` en `AdminController`) | Media | No | **Alto** (auth) | B |
| 21 | Idempotencia: calcular y comparar `requestHash` en `IdempotencyKey` | Media | No | Medio | B |
| 22 | Header `X-Confirmation-Token` para operaciones de dinero (no existe hoy) | Media | No (nuevo) | **Alto** (auth/dinero) | B |

\* No rompe contrato si los clientes ya enviaban datos válidos; si algún flujo actual dependía de que
el backend aceptara datos inválidos silenciosamente, empezaría a recibir 400 donde antes recibía 200/201.
\*\* Si algún endpoint funciona hoy sin token real por el bug de `permitAll()`, forzar autenticación real
podría romper un flujo que el frontend aún no cubre con Firebase Auth correctamente configurado.

**Tier A** = no toca auth/dinero/cifrado, no rompe contrato, riesgo bajo → puedo aplicarlo en esta fase
sin pedir confirmación adicional (ya autorizado por el spec y por "procede con la siguiente fase").
**Tier B** = toca autenticación, dinero, cifrado o es potencialmente breaking → por regla dura, necesito
tu "sí" explícito antes de tocar cada uno (o el grupo), con plan de rollback.

## Plan de commits (Tier A — se aplica ahora)

1. `feat: add springdoc-openapi` — dependencia + config mínima.
2. `fix: stop leaking exception message in generic 500 handler`
3. `fix: map InvalidCurrencyException/UnsupportedCurrencyException/QuoteExpiredException to 4xx`
4. `fix: add missing @Valid on account/transaction/beneficiary/user endpoints`
5. `fix: add validation annotations to PinSetupRequest/PinVerifyRequest/QrPayRequest`
6. `fix: remove OTP code from log statement`
7. `fix: verify ID uniqueness before persisting generated ids`
8. `feat: cursor-based pagination for GET /transactions (page/size kept as alias)`
9. `feat: add Bucket4j rate limiting scaffold on auth/transfer/qr endpoints`
10. `chore: structured JSON logging`

Cada commit incluye al menos un test. No se hace `git commit` automáticamente — dejo los cambios en el
working tree del backend (que ya tiene cambios tuyos sin commitear) para que los revises y confirmes
antes de `git add`/`git commit`, salvo que me pidas lo contrario.

## Plan para Tier B (pendiente de tu aprobación, ítem por ítem o por bloque)

Agrupo los 11 ítems de Tier B en bloques temáticos para que puedas aprobar por bloque en vez de uno por
uno:

- **Bloque Auth** (#12, #13, #20): forzar autorización real en Spring Security, arreglar IDOR, rol ADMIN
  real. Riesgo: puede exponer que algún endpoint "funcionaba" solo por el bug; requiere probar cada ruta
  después del cambio.
- **Bloque PIN/Confirmación** (#14, #22): hashear PIN existente (con migración: re-hash en próximo
  `pin/verify` exitoso, o forzar `pin/setup` de nuevo) + agregar `X-Confirmation-Token` de corta vida que
  el frontend espera para operaciones de dinero.
- **Bloque Dinero/Firestore** (#15, #16): envolver QR y transacciones sueltas en `runTransaction`; cambiar
  persistencia de `double` a `String`/centavos (incluye decidir y documentar la convención en
  `docs/DECISIONS.md`, y migrar los documentos ya sembrados por `/seed`).
- **Bloque Errores/Contrato** (#17): migrar a RFC 9457 Problem Details — esto cambia la forma del JSON de
  error que vea el frontend; si se hace, el cliente generado por `orval` debe regenerarse después.
- **Bloque Infra/CORS/Seed** (#18, #19): separar perfiles `dev`/`prod`, arreglar CORS, cerrar
  `/seed` y `/seed/purge` detrás de auth real o perfil `dev`.
- **Idempotencia robusta** (#21): calcular `requestHash` y comparar en reintentos con payload distinto.

## Gaps que requieren endpoints nuevos (no son "mejoras", son features faltantes)

KYC, dispositivos, balance dedicado por wallet, topups, withdrawals, payment-requests,
recipients/lookup, tarjetas y notificaciones no existen en el backend (ver `API_AUDIT.md`, sección
"Gaps"). Se documentarán en `docs/API_GAPS.md` y el frontend los consumirá en modo mock
(`VITE_MOCK_ENDPOINTS`) hasta que decidas si se construyen en este backend o quedan fuera de alcance.
