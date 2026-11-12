# Plan de implementación — Backend NexaBank API

Plan para cerrar los gaps identificados en `API_AUDIT.md` (sección "Gaps frente al frontend"):
KYC, tarjetas, notificaciones, topups/withdrawals, payment-requests, gestión de dispositivos,
balance dedicado, y el naming gap `accounts`≠`wallets` / `beneficiaries`≠`contacts`.

Decisiones de arquitectura ya fijadas con el usuario:

1. **Naming**: capa de alias aditiva — `/wallets` y `/contacts` delegan a los services existentes
   (`AccountService`, `BeneficiaryService`), sin tocar el dominio ni Firestore.
2. **Cards / KYC**: arquitectura de puertos/adaptadores (interfaces listas para un proveedor real,
   implementación mock hoy).
3. **Alcance**: plan completo en 7 fases, todos los módulos faltantes.

Convención de riesgo: 🔴 **Alto** = requiere aprobación explícita antes de tocar código
(auth/pagos/PII/migraciones). 🟡 **Medio**. 🟢 **Bajo**.

## Principios transversales (aplican a las 7 fases)

1. **Nunca repetir los gaps ya encontrados en el audit**: todo DTO nuevo lleva Bean Validation Y
   el controller lleva `@Valid` explícito (el audit encontró 6 endpoints donde faltaba). Checklist
   de PR por endpoint nuevo: `@Valid` presente, excepción de dominio con `@ExceptionHandler`
   dedicado (no caer en el 500 genérico), test de controller + service.
2. **Todo endpoint que mueve dinero** (topups, withdrawals, payment-requests al pagarse) reusa el
   patrón ya existente: `AccountRepository.applyBalanceDelta()` (transacción Firestore real),
   header `Idempotency-Key`, header `X-Confirmation-Token`, y un registro en `AuditLog`.
3. **Ningún secreto/dato sensible en texto plano**: cards nunca guarda PAN/CVV completos (solo
   `last4` + `token` opaco), KYC trata `documentNumber` como dato a enmascarar en logs y en
   `AuditLog.metadata`.
4. **Puertos/adaptadores para Cards y KYC**: interfaz en `service.provider.*`, implementación mock
   en `service.provider.mock.*` como `@Component` con `@ConditionalOnProperty` (perfil `dev`/
   default). El día que haya un proveedor real, se agrega una nueva implementación + config — cero
   cambios en controller/service que la consumen.
5. **Seguridad a nivel framework, no solo `SecurityUtils`**: cada ruta nueva se agrega
   explícitamente a `SecurityConfig` (pública vs autenticada vs
   `@PreAuthorize("hasRole('ADMIN')")`), nunca cae en el catch-all por omisión.
6. **Rate limiting**: extender los grupos de Bucket4j existentes (`auth`, `transfers`, `qr-pay`)
   con nuevos grupos `topups`, `withdrawals`, `kyc`, `cards` — mismo `OncePerRequestFilter` +
   `ConcurrentHashMap`, sin dependencia nueva.
7. **Documentación**: springdoc ya está instalado (Tier A) — cada DTO/endpoint nuevo lleva Javadoc
   igual que los controllers existentes; no hace falta Swagger manual.

## Fase 1 — Naming layer (Wallets/Contacts) + Balance dedicado 🟢

**Objetivo:** cerrar el gap de naming del audit sin tocar nada que ya funciona.

- `WalletController` (`/api/v1/wallets`) — delega 1:1 a `AccountService` existente. Nuevo DTO
  `WalletResponse` (mismo shape que `AccountResponse`, nombres de campo alineados al contrato del
  frontend: `walletId`, `balance`, `currency`, `status`). `/api/v1/accounts` **se mantiene** (no se
  deprecia todavía — otros consumidores podrían depender de él).
- `ContactController` (`/api/v1/contacts`) — delega a `BeneficiaryService`. DTO `ContactResponse`.
- `GET /api/v1/wallets/{id}/balance` — nuevo método en `AccountService.getBalance(id, userId)` que
  retorna `{ balance, currency, updatedAt }` sin el resto del documento (menos payload para polling
  frecuente desde el frontend).
- **Sin cambios en Firestore, sin migración, sin nuevas colecciones.** Es la fase de menor riesgo y
  mayor retorno inmediato: desbloquea Home/Balance en el frontend ya.
- Tests: `WalletControllerTest`, `ContactControllerTest` (mismo patrón que `AccountControllerTest`
  si existe, o nuevo siguiendo `BeneficiaryControllerTest`).

## Fase 2 — Notificaciones (infraestructura base) 🟢

Se construye antes de Topups/Withdrawals/Payment-requests/KYC/Cards porque todas esas fases
**emiten notificaciones** al completarse.

- Modelo `Notification`: `id, userId, type(TRANSFER_RECEIVED/TRANSFER_SENT/TOPUP_COMPLETED/
  WITHDRAWAL_COMPLETED/KYC_APPROVED/KYC_REJECTED/CARD_ISSUED/PAYMENT_REQUEST_RECEIVED/...), title,
  body, read:boolean, relatedResourceType, relatedResourceId, createdAt`.
- `NotificationRepository` (colección `notifications`) + `NotificationService.notify(userId, type,
  payload)` — método interno, no expuesto como endpoint de escritura pública.
- Endpoints: `GET /api/v1/notifications` (paginado, con el mismo cuidado que el audit pidió para
  transacciones: cursor real de Firestore, no paginación en memoria — aprovechar para hacerlo bien
  desde el día 1), `PATCH /api/v1/notifications/{id}/read`.
- **Integración retroactiva**: añadir una llamada a `NotificationService.notify(...)` en
  `TransferService.completeTransfer()` y `QrService.processQrPayment()` (los dos flujos de dinero
  que ya existen) — así no queda una fase 2 "huérfana" sin nada que notificar mientras se
  construyen las fases 4-7.
- Tests: `NotificationServiceTest`, `NotificationControllerTest`, + un caso nuevo en
  `TransferServiceTest` que verifique que se llama a `notify()`.

## Fase 3 — Gestión de dispositivos 🟡

Formaliza el concepto que el frontend ya simula en `authStore.recognizedDevices`.

- Modelo `Device`: `id, userId, deviceName, platform, pushToken?, trusted:boolean, lastSeenAt,
  createdAt`.
- `GET /api/v1/me/devices`, `DELETE /api/v1/me/devices/{id}` (revoca confianza — no es un "logout"
  real porque no hay sesión server-side, pero marca `trusted=false`, lo que puede usarse después
  para exigir re-verificación de PIN).
- **Dónde se crea un `Device`**: en `AuthService.verifyPin()` o `register()`, con upsert por
  `(userId, deviceFingerprint)` — el frontend tendría que mandar un identificador de dispositivo
  (header o campo en el body; a definir con el equipo de frontend antes de implementar).
- Riesgo 🟡 porque toca `AuthService`, pero no mueve dinero ni PII sensible más allá de lo que ya
  existe.
- Tests: `DeviceServiceTest`, `DeviceControllerTest`.

## Fase 4 — Topups y Withdrawals 🔴 (requiere aprobación antes de codear)

Mueven dinero real contra el balance → mismo nivel de cuidado que transferencias.

- Modelos `Topup` / `Withdrawal`: `id, userId, accountId, amount:BigDecimal, currency,
  source/destination(mock: "CARD"|"BANK_TRANSFER"|"CASH"), status(PENDING/COMPLETED/FAILED/
  CANCELLED), idempotencyKey, createdAt`.
- `TopupService` / `WithdrawalService` reusan `AccountRepository.applyBalanceDelta()` (positivo
  para topup, negativo para withdrawal con validación de fondos ya existente en esa misma
  transacción Firestore).
- Endpoints: `POST /api/v1/topups` (+ `Idempotency-Key`, `X-Confirmation-Token`),
  `GET /api/v1/topups`, `GET /api/v1/topups/{id}`; análogos para `withdrawals`, más
  `POST /api/v1/withdrawals/{id}/cancel` (solo si `status=PENDING`).
- Nueva excepción `InvalidTopupSourceException`/reusar `InvalidTransactionException` → mapeo en
  `GlobalExceptionHandler`.
- `AuditLog` en cada operación (mismo patrón que `TransferService`).
- Ownership: IDOR-safe desde el día 1 (el audit tuvo que corregir esto después en
  transfers/transactions — aquí se hace bien desde el inicio, pasando `userId` a todo método de
  service).
- Tests: `TopupServiceTest`/`WithdrawalServiceTest` (happy path, fondos insuficientes en
  withdrawal, idempotencia duplicada, confirmation-token inválido), tests de controller análogos a
  `TransferControllerTest`.
- **Por qué es 🔴**: es dinero moviéndose en el sistema real (aunque la "fuente" sea mock) — mismo
  nivel que #14/#15 del audit original que ya requirió hardening.

## Fase 5 — Payment Requests 🔴 (requiere aprobación — depende de Fase 4 y de Transfer existente)

"Solicitar dinero a alguien" — compone sobre `TransferService`, no lo reimplementa.

- Modelo `PaymentRequest`: `id, requesterId, payerIdentifier, amount, currency,
  status(PENDING/PAID/DECLINED/EXPIRED/CANCELLED), description, expiresAt, relatedTransferId,
  createdAt`.
- Endpoints: `POST /api/v1/payment-requests`, `GET /api/v1/payment-requests` (filtro
  `role=sent|received`), `GET /api/v1/payment-requests/{id}`,
  `POST /api/v1/payment-requests/{id}/pay` (internamente invoca `TransferService.executeTransfer()`
  con `sourceUserId=payer`, `destinationUserId=requester` — reusa confirmation-token/idempotencia
  de Transfer, no inventa una ruta de dinero paralela), `POST /api/v1/payment-requests/{id}/decline`,
  `.../cancel`.
- Expiración: job simple (`@Scheduled` cada N minutos) que marca `EXPIRED` los `PENDING` vencidos —
  mismo estilo que `DataPurgeService` ya existente.
- Notificación al crear (`PAYMENT_REQUEST_RECEIVED`) y al pagar/declinar (Fase 2).
- **Por qué es 🔴**: aunque delega el movimiento de dinero a `TransferService` ya hardened,
  introduce una superficie nueva de autorización (¿quién puede pagar/cancelar/declinar qué
  request?) que si se modela mal es un IDOR nuevo — exactamente la clase de bug que el audit
  encontró dos veces.
- Tests: ownership (requester vs payer vs tercero), expiración, doble-pago de un mismo request ya
  `PAID`.

## Fase 6 — KYC 🔴 (requiere aprobación — PII/compliance)

Arquitectura de puerto/adaptador, lista para un proveedor real futuro.

- **Puerto**: `interface KycProvider { KycSubmissionResult submit(KycSubmission s); KycStatus
  getStatus(String verificationId); }` en `service/provider/KycProvider.java`.
- **Adaptador mock**: `MockKycProvider implements KycProvider` — devuelve `UNDER_REVIEW`
  inmediatamente; la resolución a `APPROVED`/`REJECTED` se hace vía un endpoint admin (simula el
  webhook asíncrono de un proveedor real sin necesitar uno).
- **Stub de webhook preparado para el futuro**: `KycWebhookController`
  (`POST /api/v1/webhooks/kyc`) + `interface WebhookSignatureVerifier` con implementación mock
  no-op hoy; el día que haya proveedor real, se reemplaza por verificación HMAC real sin tocar el
  controller.
- Modelo `KycProfile`: `userId, status(NOT_STARTED/SUBMITTED/UNDER_REVIEW/APPROVED/REJECTED),
  documentType, documentNumber, fullName, dateOfBirth, address, submittedAt, reviewedAt,
  reviewerId, rejectionReason`.
- Endpoints usuario: `GET /api/v1/me/kyc`, `POST /api/v1/me/kyc`. Endpoints admin
  (`@PreAuthorize("hasRole('ADMIN')")`, mismo patrón que `AdminController`):
  `GET /api/v1/admin/kyc/pending`, `POST /api/v1/admin/kyc/{userId}/approve`,
  `POST /api/v1/admin/kyc/{userId}/reject`.
- **Decisión de política a confirmar en su momento**: ¿qué operaciones quedan bloqueadas sin
  `KYC=APPROVED`? (ej. withdrawals sobre cierto monto, emisión de tarjeta en Fase 7). Queda como
  punto de decisión explícito de esa fase, no se asume ahora.
- `documentNumber` nunca se loguea completo (mismo criterio que el audit aplicó al PIN) — se
  enmascara en `AuditLog.metadata` y en logs (`"****1234"`).
- Tests: `MockKycProviderTest`, `KycServiceTest` (transición de estados válida/inválida),
  `KycControllerTest`, test de que el endpoint admin exige rol ADMIN (igual que
  `SecurityConfigTest` ya hace para `/admin/metrics`).

## Fase 7 — Cards 🔴 (requiere aprobación — equivalente a dato de pago)

Mismo patrón de puerto/adaptador que KYC.

- **Puerto**: `interface CardIssuer { IssuedCard issue(CardIssuanceRequest r); void
  block(String cardId); void unblock(String cardId); void setLimits(String cardId, CardLimits
  l); }`.
- **Adaptador mock**: `MockCardIssuer` — genera `last4` y `token` opacos (UUID), **nunca** un
  PAN/CVV completo ni real, ni siquiera en el mock (para no normalizar el mal hábito de cara a un
  proveedor real futuro).
- Modelo `Card`: `id, userId, accountId, brand(mock), last4, expiryMonth, expiryYear, token,
  status(ACTIVE/BLOCKED/CANCELLED), limits{daily,monthly}, createdAt`.
- Endpoints: `GET /api/v1/cards`, `POST /api/v1/cards` (+ `X-Confirmation-Token` — emitir una
  tarjeta es sensible), `GET /api/v1/cards/{id}`, `PATCH /api/v1/cards/{id}`
  (block/unblock/límites), `DELETE /api/v1/cards/{id}` (cancelar, + `X-Confirmation-Token`).
- `AuditLog` en issue/block/unblock/cancel.
- Tests: `MockCardIssuerTest`, `CardServiceTest`, `CardControllerTest`, verificación explícita
  (como `MoneyPrecisionTest`) de que ningún test ni log expone un `last4`-equivalente completo.

## Orden de ejecución y dependencias

```
Fase 1 (naming+balance) ──┐
Fase 2 (notificaciones) ──┼──> Fase 4 (topups/withdrawals) ──> Fase 5 (payment-requests)
Fase 3 (dispositivos)  ───┘
                                Fase 6 (KYC) ──> Fase 7 (cards, posiblemente gateada por KYC)
```

Fases 1-3 pueden ir en paralelo (bajo/medio riesgo, sin dependencias entre sí). Fases 4+ son
secuenciales porque cada una compone sobre la anterior.

## Antes de empezar a escribir código

Para cada fase 🔴 (4, 5, 6, 7) se pide confirmación explícita por separado antes de tocar
`AuthService`, `AccountRepository` o crear colecciones nuevas de datos financieros/PII — no se
asume luz verde para todas de una sola vez.
