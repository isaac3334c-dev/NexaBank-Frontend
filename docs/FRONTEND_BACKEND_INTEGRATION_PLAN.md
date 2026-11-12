# Plan de integración Frontend ↔ Backend ↔ Google Cloud

Plan para dejar de operar con mocks en `NexaBank-Frontend` y conectar contra `nexabank-api`
real, desplegado en Cloud Run dentro del proyecto Firebase `nexabank-core`, soportando el
flujo objetivo:

> Usuario A se registra desde el frontend → Usuario B se registra desde el frontend → se le
> pone dinero a la cuenta de A (topup) → A transfiere a B → ambos ven el resultado reflejado
> en la UI (saldo, transacción, notificación).

Este flujo ya se verificó manualmente contra Firestore real vía `curl` (ver conversación) —
este plan es para que la UI real haga exactamente eso, no un script.

Metodología: 4 análisis en paralelo (frontend, contrato de API, infraestructura cloud,
seguridad), cada uno con contexto completo de las Fases 1-7 ya implementadas, sintetizados
aquí en un plan de ejecución por fases. Convención de riesgo igual que
`IMPLEMENTATION_PLAN.md`: 🔴 alto (requiere aprobación explícita antes de codear), 🟡 medio,
🟢 bajo.

## Decisiones ya tomadas con el usuario

1. **Twilio real**: hay cuenta Twilio real disponible → se despliega con `SPRING_PROFILES_ACTIVE=prod`
   completo desde el día 1, SMS real, sin perfil interino.
2. **KYC**: sin gate por ahora — el flujo de registro/topup/transfer opera libremente; KYC
   queda construido (Fase 6) pero no exigido. Se puede activar el gate después sin tocar el
   resto del sistema.
3. **Idempotency-Key**: se hace obligatorio (antes opcional) en los 4 endpoints que mueven
   dinero (`transfers`, `topups`, `withdrawals`, `payment-requests/{id}/pay`).

## Hallazgos consolidados de los 4 análisis

### Frontend (hoy 100% mock)
- **No hay SDK cliente de Firebase instalado** (`firebase`/`@firebase/*` ausente en
  `package.json` — solo está `firebase-tools`, que es CLI de deploy, no el SDK). Es trabajo
  nuevo, no una adaptación: el backend devuelve un *custom token* en `register`/flujo de PIN,
  que debe intercambiarse vía `signInWithCustomToken()` del SDK cliente para obtener un ID
  token real, y todo el manejo de refresh (1h) lo hace el SDK solo.
- `authStore.ts`, `walletStore.ts` son 100% mock (localStorage/zustand local) — hay que
  reemplazarlos por llamadas reales. No existen `topupStore`/`cardStore`/`kycStore`.
- `domain.ts` no calza con los DTOs reales (`Account.balance` es `Money` object vs. `number`
  plano real, etc.) — se reescribe 1:1 contra el contrato real, no se mete una capa adaptadora
  (pocos tipos, no se justifica la complejidad extra).
- Activity (Notifications), Cards, Topup/Withdraw hoy son `ComingSoonPage` sin motivo técnico
  para seguir así — el backend ya los soporta completos.

### Contrato de API
- `GET /api/v1/auth/pin/verify` responde **200 OK** con `{authenticated:false}` cuando el PIN
  es incorrecto (no es un error HTTP) — el frontend debe chequear ese campo, no el status code.
- Estandarizar en `GET /api/v1/users/me` para refetch de perfil; `GET /api/v1/auth/me` queda
  solo para el paso inmediato post-login.
- CORS en prod no tiene nada hardcodeado — depende 100% de `ALLOWED_ORIGINS` en runtime, sin
  cambios de código necesarios.
- Paginación inconsistente (`transactions` tiene modo legacy + cursor; `notifications` es
  cursor-only) — se documenta, no se unifica en esta fase.

### Infraestructura (Cloud Run + Firebase)
- Cloud Run confirmado como el runtime correcto (Firebase Hosting rewrite directo, sin Load
  Balancer manual).
- **No existe `Dockerfile`** — hace falta multi-stage (`maven:3.9-eclipse-temurin-17` →
  `eclipse-temurin:17-jre-alpine`).
- `ALLOWED_ORIGINS` real: `https://nexabank-core.web.app,https://nexabank-core.firebaseapp.com`.
- `min-instances=0` aceptable (cold start ~3-5s, ya medido en este proyecto).
- `logback-spring.xml` (JSON logging) no existe pero no bloquea — Cloud Logging captura stdout
  igual.

### Seguridad
- 🔴 **PIN sin lockout** (el OTP sí lo tiene, el PIN no) — 10.000 combinaciones posibles,
  explotable por fuerza bruta en producción real.
- 🔴 **El secreto de Firebase se hornea en el `.jar`, no solo en la imagen Docker** —
  `mvn package` ya empaqueta `src/main/resources/firebase-service-account.json` dentro del
  JAR. La única forma correcta: que el build de Docker nunca vea ese archivo (`.dockerignore`
  + build multi-stage que compila *dentro* del contenedor desde un contexto filtrado), y usar
  en su lugar las variables de entorno individuales que `FirebaseConfig` ya soporta (sin código
  nuevo) inyectadas vía Secret Manager.
- 🟡 Rate limiting en memoria (`ConcurrentHashMap`) — si Cloud Run escala a N instancias, el
  límite real efectivo es `10×N`. Mitigación simple: mantener el máximo de instancias bajo
  mientras no se migre a un backend compartido (Redis) — no se reescribe ahora.
- 🟢 Rol ADMIN manual (decisión operativa aceptada, no técnica).

## Plan de ejecución

```
Fase A (backend hardening) ──> Fase B (Docker + Cloud Run deploy)
                                        │
Fase C (frontend: Firebase Auth + cliente API) ──┐  (contra localhost:8080 para iterar rápido)
Fase D (frontend: wallet/transacciones reales) ──┼──> Fase F (activar pantallas nuevas)
Fase E (frontend: transferencia con PIN real) ───┘
                                        │
                              Fase G (re-apuntar a Cloud Run + validación end-to-end real)
```

Las fases C-F se desarrollan contra `localhost:8080` (ya probado y funcionando) para iterar
rápido sin depender del deploy; al final de Fase B, se re-apunta `VITE_API_BASE_URL` a la URL
pública de Cloud Run y se repite la validación (Fase G) contra el entorno real.

---

### Fase A — Backend: hardening pre-producción 🔴
**Agente sugerido:** `agent007:backend-db-expert` (con `agent007:security-expert` revisando)

- A1. Lockout de PIN: contador de intentos fallidos + bloqueo temporal, mismo patrón que ya
  existe para OTP (`MAX_OTP_ATTEMPTS`) — nuevo campo en `User` o documento dedicado.
- A2. `Idempotency-Key` obligatorio en `TransferController`, `TopupController`,
  `WithdrawalController`, `PaymentRequestController` (`required = false` → `true`) +
  `@ExceptionHandler(MissingRequestHeaderException.class)` en `GlobalExceptionHandler` (hoy cae
  en el catch-all genérico → 500 en vez de 400) + ajustar los tests de controller que hoy no
  mandan el header.
- A3. Verificar `mvn test` sigue en `BUILD SUCCESS`.

### Fase B — Backend: containerización y despliegue a Cloud Run 🔴
**Agente sugerido:** `agent007:platform-expert`

- B1. `.dockerignore` excluyendo `**/firebase-service-account.json`, `.env`, `target/`.
- B2. `Dockerfile` multi-stage.
- B3. Variables de entorno en Cloud Run (vía Secret Manager, nunca en el repo):
  `SPRING_PROFILES_ACTIVE=prod`,
  `ALLOWED_ORIGINS=https://nexabank-core.web.app,https://nexabank-core.firebaseapp.com`,
  `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`/`FIREBASE_PRIVATE_KEY_ID`/`FIREBASE_CLIENT_ID`
  (extraídos del JSON que ya tenemos, cargados directo a Secret Manager — nunca pegados en
  chat ni commiteados),
  `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` (el usuario los carga
  directamente en Secret Manager — nunca por chat).
- B4. Deploy (`gcloud run deploy` o Cloud Build), `min-instances=0`.
- B5. Verificar `/actuator/health` en la URL pública de Cloud Run.

### Fase C — Frontend: Firebase Auth SDK + cliente API 🟡
**Agente sugerido:** `agent007:frontend-ux-expert`

- C1. `npm install firebase`.
- C2. `.env` con `VITE_API_BASE_URL` (→ `localhost:8080` en desarrollo) + config web de
  Firebase (`apiKey`, `authDomain`, `projectId`).
- C3. Cliente API centralizado (`shared/lib/api.ts`): inyecta `Authorization: Bearer` desde
  `auth.currentUser.getIdToken()`, parsea `ErrorResponse` del backend de forma uniforme.
- C4. Reescribir `authStore.ts`: `phone/start` → `phone/verify` → `register`
  (`signInWithCustomToken`) → `pin/setup` → `pin/verify`.
- C5. Reescribir `domain.ts` 1:1 contra los DTOs reales.

### Fase D — Frontend: wallet y transacciones reales 🟡
**Agente sugerido:** `agent007:frontend-ux-expert`

- D1. Reescribir `walletStore.ts` contra `GET /wallets`, `GET /wallets/{id}/balance`,
  `GET /contacts`, `GET /transactions`.
- D2. Eliminar `completeTransfer()` local (mutación mock con aritmética float).

### Fase E — Frontend: transferencia con confirmación real 🔴
**Agente sugerido:** `agent007:frontend-ux-expert` (toca movimiento de dinero real)

- E1. Agregar paso de PIN en `ConfirmStep` (reusa el teclado de `PinPage`) → obtiene
  `confirmationToken` de `pin/verify` (vida útil 5 min, un solo uso — si el usuario tarda más,
  se re-pide).
- E2. `POST /transfers` real con `Idempotency-Key` (UUID generado client-side) +
  `X-Confirmation-Token`.
- E3. `ResultStep` reflejando la respuesta real del backend (no más éxito simulado).

### Fase F — Frontend: activar pantallas ya soportadas por el backend 🟢
**Agente sugerido:** `agent007:frontend-ux-expert`

- F1. Activity → `GET /notifications`.
- F2. Cards → `GET/POST/PATCH/DELETE /cards`.
- F3. Topup/Withdraw → `POST /topups`, `POST /withdrawals` (mismo patrón de PIN que Fase E).

### Fase G — Validación end-to-end real 🔴
**Rol:** orquestador (yo) + skill `/verify`

Repetir, ahora desde la UI real y contra la URL de Cloud Run desplegada en Fase B: A se
registra → B se registra → topup a A → A transfiere a B → ambos ven saldo/transacción/
notificación actualizados en pantalla.

## Checklist "listo para producción" (no bloquea el flujo pedido, pendiente para después)

- [ ] Rate limiting distribuido (Redis) si Cloud Run escala a más de 1 instancia
- [ ] Endpoint o proceso documentado para otorgar rol ADMIN
- [ ] `logback-spring.xml` (logging JSON estructurado)
- [ ] Decidir gate de KYC si el proyecto evoluciona a manejar dinero real regulado
