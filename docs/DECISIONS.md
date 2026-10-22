# DECISIONS — Phase 2 API Improvements

Decisiones y supuestos tomados durante la implementación de Tier A y los bloques autorizados
de Tier B (Auth, PIN/Confirmación, Dinero/Firestore), sin bloquear por ambigüedad. Backend:
`nexabank/nexabank-api`.

## Tier A

1. **springdoc-openapi version**: `2.5.0` (compatible con Spring Boot 3.2.5 / springdoc 2.x line).
   Sin configuración adicional más allá de defaults (`/swagger-ui.html`, `/v3/api-docs`).
2. **Bucket4j artifact**: usé `com.bucket4j:bucket4j_jdk11-core:8.14.0` en vez de un inexistente
   `bucket4j_jdk17-core` — no existe un artefacto específico "jdk17"; el paquete `jdk11` es
   binario-compatible y es el recomendado por el proyecto Bucket4j para JDK 11+ sin dependencias
   de almacenamiento distribuido (solo buckets en memoria local, que es lo que necesitamos aquí:
   rate limiting por IP de un solo nodo).
3. **Rate limiting**: 10 req/min por IP (o primer valor de `X-Forwarded-For`) × grupo de ruta
   (`auth`, `transfers`, `qr-pay`), implementado como `OncePerRequestFilter` + `ConcurrentHashMap`
   de buckets en memoria. No persiste entre reinicios ni es compartido entre instancias — aceptable
   para este proyecto académico de una sola instancia; si se escala horizontalmente habría que migrar
   a un backend compartido (Redis) de Bucket4j.
4. **Logging estructurado JSON**: SÍ se implementó (no se omitió) — `logstash-logback-encoder:7.4` +
   `logback-spring.xml` nuevo. Perfil `dev` → consola legible (patrón existente); cualquier otro
   perfil → JSON a stdout. Riesgo bajo, cambio aislado a un archivo de configuración de logging.
5. **PIN length**: confirmé 4-6 dígitos leyendo `RegisterRequest.pin` (`@Size(min=4,max=6)`), así que
   usé `@Pattern(regexp = "\\d{4,6}")` en `PinSetupRequest`/`PinVerifyRequest`.
6. **QrPayRequest.amount validation**: usé `@Pattern(regexp = "\\d+(\\.\\d{1,2})?")` sobre el campo
   String en el DTO en vez de capturar `NumberFormatException` en el servicio — más simple, rechaza en
   400 antes de llegar al servicio, cumple el requisito sin tocar `QrService`.
7. **Cursor pagination** (`GET /api/v1/transactions`): activado explícitamente por la presencia del
   query param `cursor` (incluso vacío = primera página por cursor). Si el cliente no envía `cursor`,
   se mantiene exactamente el comportamiento histórico `page`/`size` en memoria (sin cambios). Añadí
   el campo `nextCursor` (nullable) a `PageResponse<T>` — aditivo, no rompe el shape JSON existente.
   El cursor es el ID del último documento Firestore de la página anterior; usa `startAfter`/`limit`
   reales de Firestore ordenado por `createdAt` descendente (mismo orden que ya usaban
   `findByAccountId`/`findByUserId`).

## Bug pre-existente descubierto y corregido (no estaba en el alcance original, pero bloqueaba `mvn test`)

**`nexabank/nexabank-api` no hereda de `spring-boot-starter-parent` y su propio `maven-compiler-plugin`
(definido en el `pom.xml` PADRE, que tengo prohibido tocar en esta tarea) no incluye `<parameters>true</parameters>`.**
Como consecuencia, **todo uso de `@PathVariable`/`@RequestParam` sin nombre explícito ya fallaba en
producción** (confirmado inspeccionando el bytecode compilado: sin atributo `MethodParameters`), con
error 400 `"...parameter name information not available via reflection..."` en cualquier endpoint con
`@PathVariable String id` o `@RequestParam String x` sin el nombre explícito. Esto afectaba:
`AccountController`, `TransactionController`, `TransferController`, `BeneficiaryController`,
`FxController`, `BenchmarkController`, `QrController.decode`, `AuthController.exists`.

Como no puedo modificar `nexabank/pom.xml` (archivo explícitamente fuera de alcance, con cambios sin
commitear del usuario), apliqué el workaround estándar de Spring: nombrar explícitamente todas las
anotaciones (`@PathVariable("id")`, `@RequestParam("phone")`, etc.) en los controladores afectados.
Esto es una corrección real de un bug de producción preexistente, no un cambio de contrato — las rutas
y nombres de parámetros HTTP no cambian, solo se resuelve correctamente el binding interno.

**Recomendación para el usuario**: considerar agregar `<parameters>true</parameters>` al
`maven-compiler-plugin` en `nexabank/pom.xml` en su propia revisión de los cambios pendientes, lo que
haría el workaround (nombres explícitos) redundante pero no dañino — puede quedarse así de forma
permanente sin impacto negativo.

## Tests pre-existentes corregidos (bugs de test, no de producción, descubiertos al ejecutar `mvn test`)

- `BeneficiaryControllerTest`, `FxControllerTest`, `TransferControllerTest`: les faltaba `@MockBean
  FirebaseAuth` — sin él, el contexto `@WebMvcTest` no podía instanciar `FirebaseAuthenticationFilter`
  (Spring Boot auto-registra cualquier bean `Filter`, incluido este, independientemente del
  `SecurityFilterChain` explícito). Añadí `@AutoConfigureMockMvc(addFilters = false)` a los tres para
  que estos tests de capa web no dependan en absoluto de la cadena de filtros de seguridad real (que
  se prueba aparte, manualmente, en el bloque Auth).
- `FxControllerTest`: le faltaban `@MockBean FeeService` y `@MockBean TransferService` — el
  constructor real de `FxController` los requiere.
- `BeneficiaryControllerTest.updateBeneficiary_shouldReturnUpdated`: mezclaba un matcher Mockito
  (`any()`, `eq()`) con un valor crudo (`"BEN-000001"`) — error de Mockito
  ("3 matchers expected, 2 recorded"). Corregido envolviendo el valor crudo en `eq(...)`.
- `BeneficiaryControllerTest.getBeneficiary_shouldReturnBeneficiary`: no stubeaba
  `securityUtils.getCurrentUserId()`, por lo que el controlador pasaba `userId=null` al service y el
  mock (stubeado con `"USR-000001"` literal) no coincidía, devolviendo `null` → 200 con body vacío.
- `TransferControllerTest.createTransfer_shouldReturnCreated_whenValid`: usaba
  `anyString()` para el argumento `idempotencyKey`, que en Mockito NO matchea `null`; como el test no
  envía el header `Idempotency-Key`, el valor real es `null`. Cambiado a `any()`.
- `TransferServiceTest.executeTransfer_shouldSucceed_whenSameCurrencyAndSufficientFunds`: verificaba
  `accountRepository.updateBalance(...)`, un código path que `TransferService.completeTransfer` ya NO
  usa (usa correctamente `accountRepository.transferBalance(...)`, la vía transaccional de Firestore).
  Corregido para verificar la llamada real.

Ninguno de estos archivos de test estaba en la lista de archivos con cambios sin commitear del
usuario, así que están dentro del alcance normal de "agregar o actualizar un test" que pide la tarea.

## Bloque Auth (#12, #13, #20)

### #12 — `anyRequest().authenticated()`

- `SecurityConfig.java`: reemplazado `.anyRequest().permitAll()` por `.anyRequest().authenticated()`.
  Whitelist explícita de rutas públicas mantenida/ampliada: `GET /actuator/health`,
  `/api/v1/auth/**`, `POST /api/v1/seed` (sin cambios, tal como se indicó), `/v3/api-docs/**` +
  `/swagger-ui/**` (nuevas, de Tier A #1), `GET /api/v1/qr/decode`, `GET /api/v1/fx/rates/**`,
  `POST /api/v1/fx/convert`, `/api/v1/benchmarks/**` (demo académica).
- **Verifiqué que `FirebaseAuthenticationFilter` sí puebla un `Authentication` válido** en el
  `SecurityContext` (lo confirmé leyendo `FirebaseAuthenticationFilter.java:58-74` antes de tocar
  nada) — no fue necesario modificarlo.
- **Hallazgo durante la implementación (no estaba en el audit, lo descubrí escribiendo
  `SecurityConfigTest`)**: sin un `AuthenticationEntryPoint` explícito, Spring Security devolvía
  **403** (no 401) para requests sin token, porque no hay form-login/basic-auth configurado que
  provea uno por defecto. Agregué un `AuthenticationEntryPoint` inline en `SecurityConfig` que
  responde 401 con el mismo formato JSON que `GlobalExceptionHandler`.
- **Segundo hallazgo**: `@PreAuthorize` lanza `org.springframework.security.access.AccessDeniedException`,
  que no tenía `@ExceptionHandler` dedicado, así que cualquier rechazo de rol caía en el handler
  genérico de `Exception` → 500 en vez de 403. Agregué `@ExceptionHandler(AccessDeniedException.class)`
  → 403 en `GlobalExceptionHandler`.
- **Efecto secundario esperado y aceptado**: `DELETE /api/v1/seed/purge` no tenía regla explícita
  (el audit lo marca como "accidentalmente público" por caer en el catch-all) — tras el cambio,
  cae en `anyRequest().authenticated()` y ahora requiere un token Firebase válido (cualquier
  usuario autenticado, sin rol específico). Esto NO es una implementación de Tier B #19 (que
  pedía perfil `dev`-only o rol admin específico) — es simplemente la consecuencia natural de
  arreglar el bug #12, y es estrictamente una mejora de seguridad (de "público total" a
  "requiere autenticación"), no una regresión. `POST /api/v1/seed` permanece exactamente como
  estaba indicado (público, sin cambios).
- **Verificación exhaustiva endpoint por endpoint** contra la tabla de `API_AUDIT.md`: se revisó
  cada una de las ~40 rutas del proyecto; todas las marcadas "Pública" en el audit permanecen
  públicas, todas las que dependían de `SecurityUtils` ahora también están protegidas a nivel de
  framework (defensa en profundidad). Test dedicado `SecurityConfigTest` (7 casos) verifica con la
  cadena de filtros REAL (sin `addFilters=false`): 401 sin token, 200 con token válido en ruta
  privada, 401 con token inválido, 200 sin token en ruta pública (`qr/decode`), 403 en ruta ADMIN
  con token válido pero sin rol ADMIN, 200 en ruta ADMIN con rol ADMIN, 401 en ruta ADMIN sin token.

### #13 — IDOR en `GET /transactions/{id}` y `GET /transfers/{id}`

- `TransactionService.getTransactionById` y `TransferService.getTransferById` ahora reciben
  `userId` (vía `SecurityUtils.getCurrentUserId()` en el controller) y lanzan
  `ResourceNotFoundException` (404) si el recurso no pertenece al usuario — elegí 404 en vez de 403
  explícitamente para no filtrar la existencia del recurso (opción que el propio enunciado de la
  tarea ofrecía). Para `Transfer`, "pertenece al usuario" significa ser `sourceUserId` O
  `destinationUserId` (ambas partes de una transferencia pueden consultarla).
- Ajustado el único call site interno (`TransferService.executeTransfer`, replay de idempotencia)
  para pasar el `userId` del request actual.
- Tests nuevos: `TransactionServiceTest` (no existía, lo creé) y 3 casos nuevos en
  `TransferServiceTest` (dueño=source, dueño=destination, ni uno ni el otro → 404).

### #20 — Rol ADMIN real

- `@EnableMethodSecurity` agregado a `SecurityConfig`. `@PreAuthorize("hasRole('ADMIN')")` en los
  3 endpoints de `AdminController` (`/metrics`, `/users`, `/audit-events`).
- **Gap de operación real (documentado, no resuelto — fuera del alcance pedido)**: hoy **ningún**
  usuario tiene el rol ADMIN en ningún lugar del sistema. `FirebaseAuthenticationFilter.java:88-103`
  lee el custom claim `roles` del token Firebase y mapea cada valor a `ROLE_<valor>`; si no existe
  el claim, asigna `ROLE_USER` por defecto. No hay ningún código en el repo que escriba el claim
  `roles: ["ADMIN"]` a un usuario — ni en `AuthService`, ni en un script de administración, ni en
  el seeding. **Cómo un operador otorgaría hoy el rol ADMIN**: usando el Firebase Admin SDK (fuera
  de este backend, p. ej. desde la consola de Firebase, un script Node/Python con
  `admin.auth().setCustomUserClaims(uid, { roles: ["ADMIN"] })`, o la CLI de Firebase) sobre el UID
  del usuario que deba ser admin. El usuario afectado debe luego re-autenticarse (obtener un ID
  Token nuevo) para que el claim se refleje. No construí ninguna ruta/feature para otorgar este rol
  desde la propia API — eso excedería el alcance de "documentar el gap" de esta tarea.

## Bloque PIN/Confirmación (#14, #22)

### #14 — Hash bcrypt del PIN + migración oportunista

- `SecurityConfig` expone un bean `PasswordEncoder` (`BCryptPasswordEncoder`, 10 rondas por
  defecto). `AuthService.register()` y `AuthService.setupPin()` ahora hashean el PIN antes de
  persistirlo (`passwordEncoder.encode(pin)`).
- **Estrategia de migración oportunista** (tal como pedía el enunciado): en
  `AuthService.verifyPin()`:
  1. Si el valor almacenado empieza con `$2` (prefijo estándar de bcrypt), se verifica con
     `passwordEncoder.matches(pin, storedHash)`.
  2. Si no (PIN legacy en texto plano, de datos sembrados antes de este cambio), se compara en
     texto plano por compatibilidad retroactiva; si coincide, se re-hashea inmediatamente con
     bcrypt y se persiste ANTES de devolver la respuesta de éxito — así ese usuario queda
     migrado para la siguiente verificación, sin necesitar que rehaga `pin/setup`.
  - Esto significa que no fue necesario ningún script de migración batch: la migración ocurre
    "orgánicamente" en el primer `pin/verify` exitoso de cada usuario tras el despliegue.
- Tests nuevos (`AuthServiceTest`, no existía antes — el audit confirmó 0 cobertura de
  `AuthService`): PIN nuevo se hashea (no se guarda en claro), verificación contra hash bcrypt
  tiene éxito, verificación contra PIN legacy en texto plano tiene éxito Y dispara el rehash
  (verificado capturando el `User` guardado), PIN incorrecto falla tanto contra hash como contra
  legacy (y en ningún caso re-hashea ni emite confirmationToken).

### #22 — Header `X-Confirmation-Token`

- Nueva colección Firestore `confirmation_tokens`, modelo `ConfirmationToken`
  (`token, userId, expiresAt, used, createdAt`), repositorio `ConfirmationTokenRepository`
  siguiendo el mismo estilo que `IdempotencyRepository` (según se pidió explícitamente).
- **Vida útil elegida: 5 minutos** (dentro del rango 3-5 min sugerido) — balance entre dar tiempo
  suficiente para que el usuario complete una transferencia tras verificar su PIN, sin dejar una
  ventana de validez excesivamente larga para un token de un solo uso ligado a una operación de
  dinero inminente.
- **Semántica single-use**: `ConfirmationTokenService.validateAndConsume()` valida
  existencia → pertenencia al usuario autenticado → no expirado → no usado, y si todo pasa,
  marca `used=true` inmediatamente (antes de que el llamador continúe) — un segundo intento de
  reutilizar el mismo token siempre falla, incluso si el primer intento ocurrió hace
  milisegundos.
- Token generado: UUID aleatorio (`UUID.randomUUID()`), no un JWT firmado — es intencionalmente
  simple (opaco, de un solo uso, de vida ultra-corta, verificado server-side contra Firestore en
  cada uso) porque no necesita portar claims ni ser verificable sin consultar el backend; un JWT
  añadiría complejidad sin beneficio real en este diseño.
- Nueva excepción `InvalidConfirmationTokenException` → 401 (`INVALID_CONFIRMATION_TOKEN`) en
  `GlobalExceptionHandler`, cubriendo los 4 casos pedidos: token ausente, inexistente, de otro
  usuario, expirado, o ya usado — todos colapsan al mismo código/mensaje genérico por diseño
  (no se quiere dar pistas a un atacante sobre cuál de las 5 condiciones falló).
- **Dónde se emite**: `AuthService.verifyPin()` genera el token (vía `ConfirmationTokenService
  .generate(uid)`) solo si el PIN fue correcto, y lo expone en el nuevo campo
  `AuthResponse.confirmationToken` (aditivo — no rompe el contrato existente, los clientes que no
  lo usan simplemente lo ignoran).
- **Dónde se exige**: `POST /api/v1/transfers` (vía header `X-Confirmation-Token`, validado en
  `TransferController.createTransfer` antes de llamar a `TransferService.executeTransfer`) y
  `POST /api/v1/qr/pay` (validado en `QrController.pay` antes de llamar a
  `QrService.processQrPayment`). Son exactamente los dos endpoints de mutación de dinero que
  existen hoy, tal como especificaba el enunciado.
- Tests nuevos: `ConfirmationTokenServiceTest` (7 casos: generación con expiración de 5 min,
  válido se consume y marca usado, ausente/vacío rechazado, inexistente rechazado, de otro
  usuario rechazado, expirado rechazado, ya usado rechazado) + 2 casos nuevos en
  `TransferControllerTest` (token válido se consume, token inválido → 401 antes de llegar al
  service).

## Bloque Dinero/Firestore (#15, #16)

### #15 — Transacciones Firestore (`runTransaction`) en QrService y TransactionService

- Nuevo método `AccountRepository.applyBalanceDelta(accountId, delta)`: generaliza el patrón ya
  correcto de `transferBalance()` (lee el documento dentro de `firestore.runTransaction`,
  revalida fondos suficientes si el delta es negativo, escribe el nuevo balance) para mutaciones
  de **una sola cuenta** — exactamente lo que necesitan `QrService.processQrPayment` y
  `TransactionService.createTransaction` (ambas operan sobre una cuenta a la vez, a diferencia de
  `TransferService` que opera sobre dos).
- `QrService.processQrPayment()`: reemplacé `sourceAccount.setBalance(...)` +
  `accountRepository.save(sourceAccount)` (sobrescritura completa no transaccional) por
  `accountRepository.applyBalanceDelta(sourceAccount.getId(), amount.negate())`.
- `TransactionService.createTransaction()`: reemplacé el `findById` + `updateBalance` como
  llamadas separadas por una sola llamada a `applyBalanceDelta`, delegando la relectura y
  re-validación de fondos suficientes a la transacción de Firestore.
- **Límite de las pruebas (documentado honestamente)**: no hay emulador de Firestore configurado
  en este proyecto (solo la librería `google-cloud-firestore`, sin `firebase-tools`/Docker para
  emulación local), así que no pude escribir una prueba de integración que ejercite
  `firestore.runTransaction(...)` de verdad concurrentemente. Seguí la opción alternativa que el
  propio enunciado permitía: tests a nivel de servicio (`TransactionServiceTest`,
  `QrServiceTest`) que verifican con Mockito que se llama a `accountRepository
  .applyBalanceDelta(...)` — la vía transaccional — y específicamente que **nunca** se llama a
  `accountRepository.updateBalance(...)` ni `accountRepository.save(...)` para la mutación de
  balance (los patrones viejos, no transaccionales). Agregar un test de integración real contra
  un emulador de Firestore sería un siguiente paso recomendado pero excede el alcance de esta
  fase.

### #16 — Dinero como `String` en Firestore (no `double`)

- Cambié los 3 repositorios financieros (`AccountRepository.balance`,
  `TransactionRepository.amount`, `TransferRepository.amount`) de `.doubleValue()` /
  `doc.getDouble(...)` a `.toPlainString()` / `new BigDecimal(String)`. El JSON que ve el cliente
  HTTP no cambia (Jackson sigue serializando `BigDecimal` como número JSON) — el cambio es
  exclusivamente en cómo se persiste internamente en Firestore.
- **Decisión sobre migración de datos ya sembrados**: NO implementé una migración en vivo
  (script que reescriba documentos existentes). Como se sugería en el enunciado, dado que todos
  los datos actuales son seed/demo desechables, la recomendación es **purgar y resembrar**:
  `DELETE /api/v1/seed/purge` seguido de `POST /api/v1/seed` tras desplegar este cambio. Confirmé
  que `DataSeederService` escribe a través de `accountRepository.save(...)` /
  `transactionRepository.save(...)` (no con escritura directa a Firestore que se saltara la
  conversión), así que los datos resembrados usarán automáticamente el nuevo formato String.
- **Además de purga+resembrado, agregué compatibilidad dual-read** (no solo documenté la
  decisión — la implementé, porque el costo era mínimo y reduce el riesgo de un despliegue
  real): `readBalance()`/`readAmount()` en los 3 repositorios intentan leer el campo como
  `String` primero; si el valor almacenado no es un String (documento legado aún no migrado, p.
  ej. si alguien olvida purgar+resembrar), cae a leerlo como `double` vía
  `BigDecimal.valueOf(number.doubleValue())`. Esto significa que el sistema sigue funcionando
  correctamente incluso si queda algún documento viejo sin migrar — simplemente ese documento en
  particular seguirá teniendo el riesgo de imprecisión de `double` hasta que se reescriba (lo
  cual ocurre automáticamente la próxima vez que ese balance se actualice, porque toda escritura
  nueva usa `toPlainString()`).
- Tests nuevos: `MoneyPrecisionTest` (3 casos, sin necesidad de Firestore real) demuestra
  específicamente el caso mencionado en el enunciado — escribir 10.10 y leerlo exactamente como
  "10.10" (no 10.099999999999998) — y el caso clásico de imprecisión IEEE-754 (`0.1 + 0.2 !=
  0.3` en `double`, pero sí es exacto con `BigDecimal`/`String`).

---

# DECISIONS — Frontend Mobile Web Wallet PWA (scaffold, phase 1)

Decisiones de alcance y simplificaciones tomadas al construir el scaffold inicial del frontend
(`NexaBank Frontend`, Vite + React 19 + TypeScript strict). Esta sección documenta exclusivamente
el trabajo de frontend; no modifica ni reinterpreta las decisiones de backend arriba.

## Stack instalado (versiones verificadas como `latest` en npm al momento de la build)

- `react` / `react-dom` 19.3.1
- `vite` 8.3.5, `@vitejs/plugin-react` 6.1.2
- `typescript` 7.0.2 (el compilador nativo de TypeScript 7 — confirmado como `dist-tags.latest`
  real en el registro npm, no una preview)
- `vite-plugin-pwa` 2.0.0 (Workbox)
- `react-router-dom` 7.18.4 (modo data/SPA vía `createBrowserRouter`)
- `zustand` 5.0.15
- `@tanstack/react-query` 5.104.5
- `tailwindcss` 4.3.3 + `@tailwindcss/vite` 4.3.3 (config CSS-first con `@theme`, sin
  `tailwind.config.js`)
- `@radix-ui/react-dialog` 1.3.1, `@radix-ui/react-tabs` 1.2.1 (Tabs instalado pero no usado aún
  en ninguna pantalla de este primer pase — queda disponible para fases futuras)
- `lucide-react` 1.61.0
- `date-fns` 4.4.0 (locale `es`)
- `clsx` 2.1.1, `class-variance-authority` 0.7.1
- `@fontsource/inter` 5.3.0
- `@types/node` 26.6.5 (dev, requerido por TS7 para tipar `node:url` en `vite.config.ts`)

## Scope trims explícitamente fuera de este primer pase (según lo acordado)

- **orval / codegen de OpenAPI**: no instalado. No hay contrato OpenAPI real todavía contra el
  que generar — se usa `shared/types/domain.ts` escrito a mano, modelado para parecerse al
  contrato esperado (`docs/API_AUDIT.md`), de forma que el swap a codegen real sea aditivo.
- **MSW (Mock Service Worker)**: no instalado. Los datos mock viven en memoria vía Zustand
  (`shared/store/walletStore.ts`) y un archivo de datos estático (`shared/types/mockData.ts`),
  sin interceptar `fetch` — suficiente para navegar las 3 pantallas pedidas sin una capa de red
  real que simular todavía.
- **react-i18next**: no instalado. Todo el texto de UI está en español literal, hardcodeado en
  los componentes. No hay extracción de strings ni soporte multi-idioma en este pase.
- **recharts**: no instalado — no hay pantallas de este pase que requieran gráficos.
- **qrcode / @zxing**: no instalado — el botón de escaneo QR en el `TabBar` navega a una pantalla
  stub "Próximamente", no hay cámara ni generación/lectura real de QR.
- **react-hook-form + zod**: no instalados. El formulario de login usa estado local de React
  (`useState`) sin validación de esquema — es un solo formulario simple de 2 campos y no se
  justificó la dependencia para este pase; se reevaluará cuando haya más formularios (p. ej. KYC,
  edición de perfil) en fases futuras.
- **Storybook**: no instalado. En su lugar se construyó la ruta `/dev/ui`
  (`src/features/dev-ui/DevUiPage.tsx`) pedida explícitamente como alternativa ligera: renderiza
  cada componente del sistema de diseño con todas sus variantes/estados en una sola página
  navegable, sin la infraestructura de Storybook.
- **Playwright / Vitest**: no instalados — no hay suite de tests automatizados en este pase. La
  verificación se hizo manualmente: `npm run build` (TypeScript strict + build de producción) y
  `npm run dev` + `curl` contra las rutas servidas.
- **VITE_API_MODE**: no se creó ningún archivo `.env` ni cliente de API real — el concepto queda
  anotado aquí para fases futuras, pero no hay ninguna variable de entorno leída todavía en el
  código (no hay `import.meta.env.VITE_API_MODE` en ningún archivo).

## Simplificaciones / placeholders a tener en cuenta

- **Iconos PWA son placeholders generados programáticamente**: `public/icons/icon-{192,512}.png`
  e `icon-maskable-{192,512}.png` son cuadrados sólidos de color `#5B3DF5` con un monograma "N"
  blanco centrado, generados con ImageMagick (`convert -size ... xc:"#5B3DF5" -gravity center
  -fill white -annotate ...`). No son el logo real de NexaBank — deben reemplazarse antes de
  cualquier publicación real. Los maskable tienen el mismo contenido (no hay zona de seguridad
  real diseñada, solo el mismo monograma centrado), lo cual es aceptable para un maskable simple
  pero no está pulido.
- **No hay autenticación real**: `LoginPage` no llama a ningún backend ni valida credenciales —
  cualquier combinación de email/password navega a `/app/home` tras un `setTimeout` simulado de
  500ms (solo para mostrar el estado `loading` del botón). No hay manejo de sesión, token, ni
  persistencia de "usuario autenticado" en ningún store.
- **El flujo de transferencia siempre tiene éxito**: `ConfirmStep` no tiene ningún camino de
  error (fondos insuficientes se previene en el paso de monto, pero no hay simulación de fallo de
  red, timeout, o rechazo del backend). El estado `error` de este flujo está documentado en el
  registro de discovery (`.claude/state/discovery-output.json`) pero no implementado — reservado
  para cuando haya una capa de red real que pueda fallar de verdad.
- **Comisión de transferencia fija y hardcodeada**: `TRANSFER_FEE` en `shared/types/mockData.ts`
  es un valor fijo de `S/ 2.00` para todas las transferencias, sin lógica de cálculo real (por
  monto, por tipo de cuenta destino, etc.).
- **Aritmética de dinero en el mock**: `walletStore.completeTransfer` hace
  `Number(balance) - Number(amount) - Number(fee)` para actualizar el saldo mock. Esto es una
  conversión a punto flotante, documentada explícitamente como aceptable SOLO para este dato mock
  (montos pequeños, ya validados, sin persistencia real) — ver el comentario extenso al inicio de
  `shared/lib/money.ts`. Este patrón NO debe copiarse para mutaciones de dinero reales contra un
  backend; ahí se necesitaría una librería decimal apropiada o dejar que el backend sea la única
  fuente de verdad del nuevo balance.
- **Theming claro/oscuro**: `ThemeProvider` existe y aplica `data-theme` al `<html>`, con
  persistencia en `localStorage` (con manejo de excepción si falla), pero no hay ningún control
  de UI todavía para que el usuario cambie el tema manualmente — solo reacciona a
  `prefers-color-scheme` del sistema por defecto.
- **Tabs de bottom nav sin implementar**: de las 4 tabs + botón central de escaneo, solo
  "Inicio" tiene contenido real. "Actividad", "Tarjetas", "Perfil" y "Escanear QR" son la misma
  pantalla stub `ComingSoonPage` con un `EmptyState` de "Próximamente". Las acciones rápidas
  "Recibir", "Recargar" y "Retirar" en Home también navegan a stubs equivalentes — solo "Enviar"
  tiene un flujo completo.

## Hallazgo de accesibilidad en los tokens de color (documentado, no corregido)

Verifiqué los 11 pares de color texto/fondo especificados contra WCAG AA (4.5:1 texto normal,
3:1 texto grande) usando la fórmula de contraste relativo estándar (W3C). Resultado: **10 de 11
pares cumplen**, pero **`--color-text-subtle` (`#8D93A6`) sobre `--color-bg` (`#F6F7FB`) en modo
claro da 2.86:1 — no cumple ni el umbral de texto grande (3:1)**. Sobre `--color-surface`
(blanco puro) el mismo color sí alcanza 3.06:1 (pasa para texto grande, no para texto normal).

Como los tokens fueron especificados exactamente ("usa EXACTAMENTE este CSS") y no se pidió
autorización para alterar valores hexadecimales, NO cambié ningún valor en `tokens.css`. En su
lugar, mitigué el riesgo a nivel de uso: en los componentes construidos en este pase,
`text-text-subtle` solo se usa sobre `bg-surface` (nunca directamente sobre `bg-bg` para texto
pequeño) — por ejemplo las etiquetas inactivas del `TabBar` usan `text-text-muted` (5.49:1 sobre
`bg`, cumple) en vez de `text-text-subtle`. Recomendación para una fase futura: oscurecer
levemente `--color-text-subtle` (p. ej. a algo cercano a `#7C8299`) si se necesita usarlo de
forma segura directamente sobre `--color-bg` para texto de cualquier tamaño.

## Verificación ejecutada

- `npm run build` → `tsc -b && vite build` — compila sin errores de TypeScript strict (sin
  ningún `any` explícito en el código propio) y genera el bundle de producción + manifest PWA +
  service worker (Workbox, `generateSW`, 41 entradas precacheadas).
- `npm run dev` → servidor Vite arrancado en `http://localhost:5173/`; verificado con `curl` que
  `/`, `/dev/ui`, `/auth/login`, `/app/home`, `/transfer`, `/manifest.webmanifest` y los íconos en
  `/icons/*.png` responden `200`. Log del servidor revisado — sin errores ni warnings.
- `npm run lint` (`tsc -b --noEmit`) — sin salida, sin errores.

## Bug encontrado y corregido durante la build (no es una decisión de producto, es un bug propio)

El comentario original planeado para `src/styles/index.css` —
`/* Typography sizes (paired with line-height via text-*/leading-* utilities) */` — contiene un
`*/` literal dentro del texto (`text-*/leading-*`), que cierra el comentario CSS antes de tiempo
y corrompe el resto del bloque `@theme`, causando `CssSyntaxError: Missing opening (` en
`vite build`. Aislado con bisección binaria del archivo y corregido reescribiendo el comentario
sin esa secuencia de caracteres. También se eliminaron las sub-claves `--text-*--font-weight`
dentro de `@theme` (no es sintaxis válida de Tailwind v4 — el namespace de peso de fuente es
`--font-weight-*`, independiente, no un sufijo pareado de `--text-*` como sí lo es
`--line-height`): el peso de cada estilo tipográfico se aplica ahora vía reglas explícitas en
`@layer base` sobre las clases generadas (`.text-h1`, `.text-h2`, etc.), ver `src/styles/index.css`.

---

# Auth flow correction (phone + OTP + PIN/biometric)

El `LoginPage` original (email + password) no correspondía al backend real, que autentica por
**teléfono + OTP (primera vez) + PIN o biometría (usuarios recurrentes)**. Esta sección documenta
el reemplazo completo del flujo de auth del frontend, construido 100% con estado mock/local
(`shared/store/authStore.ts`), sin ninguna llamada real a backend.

## Credenciales/códigos de demo (hardcodeados, documentados aquí por diseño)

- **Código OTP válido**: `123456` — el único código que la pantalla `/auth/otp`
  (`src/features/auth/OtpPage.tsx`) acepta como correcto, para cualquier número de teléfono.
  Cualquier otro valor de 6 dígitos dispara el estado de error (shake + texto), sin bloqueo/lockout.
- **Teléfono demo pre-registrado**: `+51 987 654 321` — reutilizado deliberadamente del contacto
  mock existente `Rodrigo Salazar` en `shared/types/mockData.ts` (constante `mockContacts[0]`) para
  no introducir un número duplicado con formato inconsistente. Exportado como `DEMO_PHONE` desde
  `authStore.ts`.
- **PIN demo**: `1234` — PIN ya asignado al teléfono demo en el seed inicial del store
  (`DEMO_PIN`). Usuario de nombre `Rodrigo Salazar` (`DEMO_NAME`), sin email (campo opcional
  vacío).

## Cómo se simula "dispositivo reconocido" (y por qué está scoped por teléfono, no global)

`authStore.ts` mantiene dos diccionarios independientes, ambos persistidos:

- `registeredUsers: Record<phone, { name, email?, pin }>` — qué teléfonos existen como cuenta.
- `recognizedDevices: Record<phone, boolean>` — si *este* dispositivo (en la práctica: este
  localStorage) ya completó el flujo de PIN/registro para *ese* teléfono específico.

Deliberadamente **no** hay un flag global `deviceRecognized: boolean` — si lo hubiera, marcar el
dispositivo como reconocido tras probar el teléfono demo rompería la posibilidad de probar el
camino completo de un teléfono nuevo (`/auth/phone` → `/auth/otp` → `/auth/register` →
`/auth/create-pin`) en la misma sesión del navegador, porque cualquier teléfono nuevo heredaría
"reconocido = true". Al estar indexado por teléfono, cada número tiene su propio estado
independiente:

- Teléfono demo (`+51 987 654 321`): seedeado con `recognizedDevices['+51 987 654 321'] = true` →
  entrar ese número en `/auth/phone` navega directo a `/auth/pin`.
- Cualquier teléfono nuevo: no existe en `registeredUsers` ni en `recognizedDevices` → navega a
  `/auth/otp`, y tras el OTP correcto, a `/auth/register` (si nunca se registró) o
  `/auth/create-pin` (si está registrado pero este "dispositivo" no está reconocido para ese
  número — p. ej. tras usar "¿No eres tú? Cambiar número").
- `/auth/pin` (`PinPage.tsx`) nunca queda en blanco durante desarrollo: si `authStore.phone` es
  `null` (se navegó directo a la ruta sin pasar por `/auth/phone`), la pantalla cae al usuario demo
  (`DEMO_PHONE`/`DEMO_NAME`) tanto para mostrar nombre/teléfono como para validar el PIN ingresado.

El link "¿No eres tú? Cambiar número" en `PinPage` llama a `forgetDevice(phone)`, que pone
`recognizedDevices[phone] = false` para ese teléfono únicamente (no afecta a otros números ya
reconocidos) y regresa a `/auth/phone`.

## Comportamiento explícitamente mockeado/placeholder

- **Biometría (Face ID) es 100% visual, sin WebAuthn real**: el botón "Usar Face ID" en
  `PinPage.tsx` dispara un estado local `scanning` (pulso ~1.2s vía `animate-pulse` +
  `ScanFace` de `lucide-react`) seguido de un estado `success` (ícono `Check`), y luego navega
  incondicionalmente a `/app/home` — es un éxito simulado, no verifica nada real. Si
  `prefers-reduced-motion: reduce` está activo (detectado con
  `window.matchMedia('(prefers-reduced-motion: reduce)')`), se omite el estado `scanning` y se
  salta directo al checkmark estático antes de navegar.
- **Reenvío de OTP es un countdown falso**: el link "Reenviar código" en `OtpPage.tsx` solo reinicia
  un `setState` de 30 segundos; no se reenvía ningún SMS real ni se vuelve a aceptar un código
  distinto de `123456`.
- **Sin lockout en PIN ni OTP**: tanto `PinPage` como `OtpPage` permiten intentos ilimitados tras un
  error (shake + texto inline), sin bloqueo temporal ni límite de intentos — una decisión de scope
  explícita para este pase mock, a revisar cuando exista backend real con rate limiting (ver
  Bucket4j en el bloque de backend arriba).
- **Animación de shake respeta `prefers-reduced-motion`**: se agregó `@keyframes shake` +
  `.animate-shake` en `src/styles/index.css`, reutilizando la regla global ya existente en
  `@layer base` (`@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms
  !important; ... } }`) — no fue necesaria una rama de código separada para el caso
  reduced-motion del shake en sí, esa regla CSS global ya la neutraliza.
- **Componentes extraídos y reutilizados**: el teclado numérico inline que ya existía en
  `AmountStep.tsx` (`src/features/transfer/steps/AmountStep.tsx`) se extrajo a
  `src/shared/ui/NumericKeypad.tsx` (prop `showDecimal` para omitir la tecla "." — el teclado de
  PIN la omite explícitamente) y `AmountStep.tsx` ahora lo consume en vez de declarar su propio
  JSX de teclado. El input OTP es un componente nuevo, `src/shared/ui/OtpInput.tsx` (6 casillas,
  auto-avance, retroceso, pegado de código completo, `inputMode="numeric"` +
  `autoComplete="one-time-code"`, target táctil ≥44px).
- **PIN nunca se muestra en texto plano**: tanto `CreatePinPage` como `PinPage` renderizan el PIN
  como puntos llenos/vacíos (`●`/`○`, vía `<span>` circulares), nunca los dígitos reales — el valor
  numérico solo vive en estado de React, nunca en el DOM visible.

# Obsidiana y Lima redesign (reemplazo completo del sistema de diseño, fase 3)

Reemplazo integral del sistema claro-primero (tokens, `BalanceCard` con gradiente, escala de
radios anterior) por un nuevo concepto oscuro-primero ("Obsidiana y Lima" — estilo Revolut Metal /
Nubank Ultravioleta: superficies oscuras sobrias, un único color vivo de acento usado con
moderación). Aplicado a **todas** las pantallas ya construidas, no solo a componentes nuevos en
aislamiento: `/dev/ui`, `/app/home`, todo `/auth/*`, y todo el flujo `/transfer`.

## Fuente tipográfica: Geist (self-hosted vía `@fontsource/geist-sans` + `@fontsource/geist-mono`)

Antes de asumir que Geist no estaría disponible vía fontsource (como advertía el brief), verifiqué
con `npm view @fontsource/geist-sans versions` / `npm view @fontsource/geist-mono versions` — ambos
paquetes existen en npm (última versión `5.3.0` al momento de esta build) y se instalaron sin
fricción:

```
npm install @fontsource/geist-sans@5.3.0 @fontsource/geist-mono@5.3.0
```

Se usa el mismo patrón que ya existía para `@fontsource/inter` (imports de pesos específicos en
`src/styles/index.css`: `400/500/600/700` para Geist Sans, `400/500/600` para Geist Mono — Geist
Mono no se usaba en ningún peso 700 existente). `@fontsource/inter` se eliminó del `package.json`
al dejar de importarse desde `index.css` — no se usa en ningún otro archivo del proyecto, se
verificó con `rg "@fontsource/inter"` antes de quitar el import. Manrope **no se instaló como
paquete** — se mantiene únicamente como el nombre de fallback CSS documentado por el brief
(`--font-sans: "Geist", Manrope, system-ui, ...`), ya que Geist sí estaba disponible limpiamente y
no había necesidad de un fallback real auto-hosteado.

## Tokens derivados no especificados exactamente por el brief

El brief daba la paleta base, `--radius-card/sheet/pill` y `--font-sans/mono` de forma literal.
Todo lo demás listado abajo es una decisión de diseño tomada en esta fase, no una copia del brief:

- **`--color-text-subtle` fue ELIMINADO**, no solo renombrado. Este token tenía un hallazgo de
  accesibilidad pendiente desde la fase anterior (ver sección "Hallazgo de accesibilidad en los
  tokens de color" arriba): `#8D93A6` sobre `--color-bg` claro medía 2.86:1, por debajo del mínimo
  3:1 incluso para texto grande. En vez de simplemente ajustar el valor hex, se decidió colapsar la
  jerarquía de tres niveles de texto (text / text-muted / text-subtle) a dos (text / text-muted) —
  cada uso de `text-subtle` en el código (`Input.tsx`, `PhonePage.tsx`, `DevUiPage.tsx`) ahora usa
  `text-muted`. Verificado con la fórmula de contraste relativo W3C: `--color-text-muted` sobre
  `--color-bg` da **6.31:1 en oscuro** y **5.44:1 en claro** — ambos superan 4.5:1 AA para texto
  normal con margen. Esto es una corrección deliberada del hallazgo previo, no solo una
  simplificación de conveniencia.
- **`--color-accent` fue ELIMINADO como token distinto.** Este concepto tiene exactamente un color
  vivo de acento (el lima `--color-primary`), usado tanto para acciones primarias como para
  éxito/dinero-entrante — no existe un segundo acento. El único uso previo de `--color-accent`
  (teal `#00C2A8` en el logo degradado de `PhonePage`) se reemplazó por `bg-primary` sólido al
  eliminar el gradiente (ver más abajo).
- **Variantes `-soft` (tintes de fondo para `Badge`/`StatusPill`/`EmptyState`/`ErrorState`)**: el
  brief no especifica estos valores, solo sugiere `color-mix(in srgb, var(--color-X) N%,
  transparent)` como técnica. Verifiqué cada combinación texto-sobre-tinte resultante contra WCAG
  AA (4.5:1, ya que el texto de `Badge` es 13px/caption — no califica como "texto grande" aunque
  sea `font-medium`) con la fórmula de contraste relativo W3C, usando un script Python ad-hoc
  (no committeado, solo para verificación durante el desarrollo). Valores finales:
  - Oscuro: `success-soft`/`danger-soft`/`warning-soft` al **16%** → 9.37:1 / 4.81:1 / 7.23:1,
    todos pasan. `info-soft` al 16% medía solo 4.28:1 (falla por un margen pequeño) — se bajó a
    **12%** → 4.57:1, pasa.
  - Claro: `success-soft`/`info-soft` al **14%** → 5.73:1 / 5.23:1, pasan. `danger-soft` al 14%
    medía 3.92:1 (falla) — el rojo `#D92D20` es lo bastante saturado que aumentar la opacidad del
    tinte sobre blanco en realidad *reduce* el contraste (el fondo se acerca más al color del
    texto), así que se usó un tinte mucho más sutil, **4%** → 4.56:1, pasa. Lo mismo le pasaba a
    `warning-soft` al 14% (4.43:1, falla) — se bajó a **12%** → 4.56:1, pasa.
  - Ningún par quedó por debajo de 4.5:1 en la versión final de `tokens.css`.
- **`--color-info`**: no forma parte de la paleta del brief. Se mantiene como un azul apagado y
  desaturado (`#7C8CA6` oscuro / `#51607A` claro) para que funcione como indicador neutral/calmado
  sin competir con el lima como un segundo color vivo — consistente con la filosofía "un solo
  acento" del brief. No se colapsó la variante `info` de `Badge` en `neutral` porque sí hay un caso
  de uso real distinguible (`STATUS_META.REVERSED` en `TransactionItem.tsx` usa `variant: 'info'`
  para "Revertida", que es semánticamente distinto de un estado neutral genérico).
- **`--tabbar-bg` (rgba translúcido del `TabBar` flotante)**: el brief da el valor oscuro
  literalmente (`rgba(20,22,25,.8)`, que coincide con `--color-surface-2` oscuro al 80% de alpha).
  El valor claro (`rgba(255,255,255,.8)`) es una derivación directa — mismo alpha, color de
  superficie claro en vez de oscuro — ya que el brief no daba un valor claro explícito.

## Tema oscuro por defecto (y eliminación de `'system'`)

`ThemeProvider.tsx` cambió su tipo `Theme` de `'light' | 'dark' | 'system'` a solo `'light' |
'dark'`, con `'dark'` como valor por defecto/fallback (antes era `'system'`). Se eliminó la opción
`'system'` deliberadamente, no solo se cambió el default: la intención del brief es un dark-mode
explícito por defecto con claro como opt-in manual, no un modo que siga la preferencia del SO — "un
modo que sigue al SO" y "oscuro por defecto explícito" son filosofías en tensión (si el SO del
usuario está en claro, `'system'` mostraría claro desde el primer arranque, contradiciendo el
"default oscuro"). Como no existe pantalla de Ajustes real todavía, `setTheme('light')` sigue
siendo completamente alcanzable y persistente (vía `localStorage`, misma clave `nexabank-theme`) — solo que el
único lugar donde se puede invocar hoy es el toggle nuevo en `/dev/ui` (ver abajo).

Para evitar un flash-of-wrong-theme antes de que React monte y lea `localStorage`, `index.html`
ahora pone `data-theme="dark"` estáticamente en `<html>` (cero JS, cubre el caso por defecto) más
un script inline pre-React que solo necesita *subir* a `data-theme="light"` si `localStorage` ya
tenía esa preferencia guardada — nunca necesita hacer el camino inverso porque "dark" ya es el
valor estático de partida.

## Toggle de tema en `/dev/ui` (no en Ajustes — Ajustes no existe todavía)

Como no hay pantalla de Ajustes real (`ComingSoonPage` stub en `/app/profile`), se agregó un toggle
de tema pequeño y discreto en el header de `/dev/ui` (`ThemeToggle`, consume `useTheme()` de
`ThemeProvider`) para que el modo claro siga siendo testeable/revisable visualmente sin construir
Ajustes en esta fase. **Dejado explícitamente para una fase futura**: UI de toggle de tema dentro
de una pantalla de Ajustes real.

## Sin gradientes — `BalanceCard` y logo de `PhonePage`

Se eliminó `--gradient-balance` de `tokens.css` y las dos referencias que existían:
`BalanceCard.tsx` (fondo del hero de saldo) y `PhonePage.tsx` (ícono de logo "N"). Ambos ahora usan
relleno sólido (`var(--color-surface)` con borde `rgba(198,244,50,.25)` en `BalanceCard`; `bg-primary`
sólido en el logo). La profundidad viene de superficies apiladas (`bg` → `surface` → `surface-2`) y
bordes de 1px, no de gradientes ni sombras pesadas — las sombras existentes (`--shadow-sm/md/lg`) se
redujeron de opacidad/alcance y su uso se limitó a casos estructurales (p. ej. el "lift" del
`BottomSheet`, que necesita algo para leerse como elevado sobre un fondo oscuro donde un borde solo
no alcanza).

## `BalanceCard`: saldo en dos niveles, textura de ruido, variación mensual mockeada

- **Textura de ruido sutil (~3%)**: implementada como un `background-image` con un SVG inline
  (`feTurbulence type="fractalNoise"` + `feColorMatrix` para fijar el canal alfa en `0.03`
  directamente dentro del propio SVG, en vez de aplicar una `opacity` CSS separada al elemento
  contenedor). Esto mantiene la técnica autocontenida en una sola propiedad CSS y evita que una
  `opacity` a nivel de contenedor afecte accidentalmente el borde o el contenido si el overlay no
  quedara perfectamente aislado en un `div` propio.
- **Saldo en dos niveles (parte entera grande + decimales pequeños y mudos)**: nuevo componente
  `src/shared/ui/MoneyDisplay.tsx`. Divide el string YA formateado por `formatMoney()` en la última
  ocurrencia de `.` o `,` seguida de 1-2 dígitos — deliberadamente no asume qué carácter es el
  separador decimal (distintos locales usan uno u otro vía `Intl.NumberFormat`), solo opera sobre
  lo que `formatMoney()` ya produjo. El tratamiento (44px/600/-0.02em para la parte entera, 60% del
  tamaño — 26.4px — en `--color-text-muted` para los decimales) se aplicó solo a `BalanceCard` y al
  `AmountStep` de `/transfer` (no se convirtió `text-display` global a 44px) — el brief es
  específico sobre "el saldo", así que escopar el tratamiento a contextos de monto hero es más
  seguro que un cambio típográfico global que afectaría otros usos de `text-display` no
  relacionados con dinero.
- **Variación mensual mockeada**: la línea "+12% este mes" bajo el saldo usa un valor estático
  (`MOCK_MONTHLY_VARIATION_PCT = 12` en `BalanceCard.tsx`) — no hay datos históricos de saldo reales
  todavía para calcularlo. **Dejado explícitamente para una fase futura**: cálculo real a partir del
  historial de transacciones cuando exista backend real.
- **Nota para la futura pantalla de Tarjetas**: no se construyó `/app/cards` en esta fase (sigue
  siendo el stub `ComingSoonPage`). Cuando se construya, debería reutilizar el mismo lenguaje visual
  oscuro/números-monoespaciados/branding-sutil que `BalanceCard` (superficie plana + borde lima
  sutil + textura de ruido ~3% + `--font-mono` para los últimos 4 dígitos de la tarjeta).

## Conteo ascendente del saldo (count-up) y `prefers-reduced-motion` en animaciones JS

Nuevo hook `src/shared/lib/useCountUp.ts`: anima de 0 al valor real en 600ms vía
`requestAnimationFrame` + curva ease-out cúbica, sin dependencia nueva. La regla CSS global de
`prefers-reduced-motion` en `index.css` (`transition-duration`/`animation-duration` a `0.01ms`) NO
puede neutralizar un loop de `requestAnimationFrame` controlado por JS — por eso el hook verifica
`window.matchMedia('(prefers-reduced-motion: reduce)').matches` directamente y, si está activo,
salta derecho al valor final sin ejecutar ningún frame de animación. El mismo patrón (chequeo JS
explícito, no solo depender de la regla CSS) se usó en `TransferPage.tsx` (transición de slide
entre pasos) y `ResultStep.tsx` (dibujo del check + aterrizaje del monto final).

## Transiciones de 200ms entre pasos de `/transfer`

`TransferPage.tsx` ahora envuelve cada paso (`ContactStep`/`AmountStep`/`ConfirmStep`/`ResultStep`)
en un componente `StepSlide` que anima `transform`/`opacity` en 200ms al cambiar de paso, con
dirección derivada de si el índice del paso nuevo es mayor o menor que el anterior (se guarda en un
`ref`, no en estado, para no disparar un render extra). Bajo `prefers-reduced-motion`, `StepSlide`
arranca ya "entrado" (sin desplazamiento inicial) en vez de animar — tanto por la regla CSS global
(`transition-duration` neutralizado) como por un chequeo JS explícito que evita el `requestAnimationFrame`
de doble-rAF usado para forzar el estado inicial antes de la transición.

## Curva de spring/overshoot para `BottomSheet`

Se usó `cubic-bezier(.34,1.56,.64,1)` (registrada también como `--ease-spring` en el `@theme` de
`index.css`, aunque `BottomSheet.tsx` la aplica inline vía clase arbitraria de Tailwind) en vez de
la curva estándar `cubic-bezier(.2,.8,.2,1)` usada en el resto de la app, específicamente para la
entrada del sheet — el overshoot leve (`1.56` > 1) da la sensación de que el sheet "rebota" un poco
al asentarse, en vez de una desaceleración plana.

## `ResultStep`: checkmark dibujado, haptic feedback, aterrizaje del monto

- **Checkmark que se dibuja**: un `<svg>` con un `<circle>` y un `<polyline>` en forma de check,
  cada uno con `stroke-dasharray` igual a su longitud real y una animación CSS
  (`.animate-checkmark` en `index.css`) que anima `stroke-dashoffset` de la longitud completa a 0.
  El `polyline` tiene un `animationDelay` de 280ms para que dibuje después de que el círculo
  termine, no simultáneamente.
- **Haptic feedback**: `navigator.vibrate?.([15])` — feature-detectado con `?.`, no-op silencioso
  donde no hay soporte (la mayoría de navegadores de escritorio, Safari en iOS). Patrón muy corto
  (`[15]`ms) para que sea un pulso discreto, no una vibración notoria.
- **Aterrizaje del monto final**: el bloque de texto con el monto enviado anima `opacity`/`transform
  translateY/scale` desde un estado inicial ligeramente desplazado y escalado hacia abajo, 300ms
  después de que termina el dibujo del checkmark (420ms) — controlado por un `setState` con
  `window.setTimeout`, saltado por completo bajo `prefers-reduced-motion` (arranca ya "aterrizado").

## Shimmer de `Skeleton` atenuado

Se reemplazó la clase `animate-pulse` de Tailwind (que anima opacidad 1 → .5, un salto grande) por
un keyframe propio `skeleton-shimmer` (`index.css`) que anima solo 1 → .82 — un delta de opacidad
mucho más pequeño, apenas perceptible, consistente con el pedido explícito del brief de atenuar el
shimmer existente.

## Botones, chips y forma de píldora (`--radius-pill`)

Todas las variantes de `Button` (`primary`/`secondary`/`ghost`/`danger`), `Badge`/`StatusPill`, y
los botones de `NumericKeypad` ahora usan `rounded-[var(--radius-pill)]` (999px). La variante
`secondary` de `Button` cambió de `bg-primary-soft text-primary` a `bg-surface-2 text-text` (sin
borde) per el brief — esto también resolvió de paso un contraste pobre que hubiera tenido
`text-primary` (lima) sobre `bg-primary-soft` en modo claro (1.23:1, medido durante la verificación
de los tokens `-soft`) ya que ese par de color ya no se usa en ningún lado. La variante
`on-gradient` de `IconButton` se renombró a `on-surface` (ya no hay gradiente sobre el cual
"estar"). Las cajas individuales de `OtpInput` se mantuvieron en `--radius-md` (rounded-square), no
píldora — una caja de un solo carácter en forma de píldora de 999px se vería como un óvalo
aplastado, no como un chip; el tratamiento píldora del brief se aplicó en su lugar a los puntos de
PIN (`rounded-full`, ya equivalente a píldora en un círculo) y a los botones del `NumericKeypad` en
ese mismo flujo.

## `TabBar` flotante

Flotante con 12px de margen (`left-3 right-3`, no edge-to-edge), fondo traslúcido +
`backdrop-filter: blur(20px)` (vía `backdrop-blur-xl` de Tailwind) en ambos temas usando el token
`--tabbar-bg` derivado arriba. El botón central de QR ahora es un círculo lima de 64px
(`size-16`) elevado `-translate-y-5` (20px) sobre la línea base de la barra, más grande que los
demás ítems de navegación — se ve como un FAB que rompe el borde superior de la barra, no como otro
ícono de tab más. La barra sigue respetando `env(safe-area-inset-bottom)`, pero ahora compuesto con
el margen flotante vía `calc(env(safe-area-inset-bottom) + 12px)` aplicado directamente al `bottom`
inline — así el margen de 12px y el safe-area del home-indicator se suman en vez de que uno
reemplace al otro. `AppLayout.tsx` subió su padding inferior de `pb-24` a `pb-28` para compensar la
huella más grande de la barra flotante + FAB elevado.

## Lista de transacciones sin divisores

`TransactionItem` ya no se renderiza dentro de un contenedor `divide-y divide-border` en
`HomePage.tsx` — la separación ahora es solo por espaciado vertical (`flex flex-col gap-1`). El
mismo cambio se aplicó, por consistencia visual (no era un requisito explícito del brief para esa
pantalla específica, pero es el mismo patrón de lista), a `ContactStep.tsx` en `/transfer`, que
tenía el mismo patrón de lista con divisores.

## `--font-mono`: disponible, pero sin código de referencia visible aún para aplicar

El brief pedía aplicar `--font-mono` a "códigos de referencia/ID de transacción ya renderizados" —
se revisó `TransactionItem.tsx` y los pasos de `/transfer` (`ConfirmStep.tsx`, `ResultStep.tsx`) y
ninguno renderiza actualmente un número de referencia/ID visible al usuario (el campo `id` de
`Transaction` solo se usa como `key` de React, nunca en el DOM visible). No había nada existente a
qué aplicar la fuente monoespaciada. El token `--font-mono` (Geist Mono) está disponible y
demostrado en la sección "Typography scale" de `/dev/ui` para cuando se necesite (últimos 4 dígitos
de tarjeta cuando se construya esa pantalla, o si se agrega un número de referencia visible a
`ConfirmStep`/`ResultStep` en una fase futura).

## PWA manifest y `theme-color` (`vite.config.ts`, `index.html`)

No estaba en la lista explícita de archivos del brief, pero es una asunción de modo claro
hardcodeada que corresponde arreglar en este pase: `manifest.theme_color`/`background_color` en
`vite.config.ts` (usados para el splash screen de instalación PWA y el chrome del SO) seguían en
`#5B3DF5`/`#F6F7FB` (morado/claro del sistema anterior). Se actualizaron a `#0A0B0D` (igual que
`--color-bg` oscuro) en ambos campos, y el `<meta name="theme-color">` de `index.html` se actualizó
del mismo morado a `#0A0B0D` también.

## Verificación ejecutada (fase Obsidiana y Lima)

- `npm run build` (`tsc -b && vite build`) → compila sin errores de TypeScript strict, sin `any`.
- `npm run dev` + `curl` a las 9 rutas pedidas (`/`, `/dev/ui`, `/auth/phone`, `/auth/otp`,
  `/auth/register`, `/auth/create-pin`, `/auth/pin`, `/app/home`, `/transfer`) → **200 en las 9**.
  Servidor de dev detenido después de la verificación.
- `docs/API_AUDIT.md` y `docs/API_IMPROVEMENTS.md` no se tocaron en esta fase. No se ejecutó ningún
  comando de `git`.
