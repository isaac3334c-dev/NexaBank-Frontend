# API Audit

## Resumen

Auditoría del backend `NexaBank API` (Spring Boot 3.2.5 / Java 17) ubicado en
`/home/danidev/Documentos/Dev/NexaBank API/NexaBank-Backend/nexabank/nexabank-api`, antes de construir el nuevo
frontend PWA. El proyecto es, según `ENTREGA2_INFORME.md:1-5`, una entrega académica de un curso de
Estructuras de Datos y Algoritmos ("NexaBank Backend") que simula un backend bancario completo
(usuarios, cuentas, transferencias, FX, QR, beneficiarios) sobre Firebase Firestore, con un módulo
adicional de estructuras de datos propias (listas, pilas, colas) y benchmarks.

Hallazgo más importante: **la seguridad no está realmente aplicada**. `SecurityConfig` registra el
filtro de Firebase pero permite el acceso a *todas* las rutas (`anyRequest().permitAll()`), por lo que
ningún endpoint —incluidos transferencias y datos de administrador— exige un token válido a nivel de
Spring Security; la protección real depende de que cada controlador llame manualmente a
`SecurityUtils.getCurrentUserId()`, y varios no lo hacen (IDOR). Además, el dinero se maneja como
`BigDecimal` en el código Java pero se **persiste como `double` en Firestore** en todas las colecciones
financieras, y el PIN de usuario se guarda y compara en **texto plano**. El resto del documento detalla
cada hallazgo con archivo y línea.

## Stack detectado

- **Lenguaje / runtime:** Java 17 (`pom.xml` padre: `<java.version>17</java.version>`,
  `/home/danidev/Documentos/Dev/NexaBank API/NexaBank-Backend/nexabank/pom.xml:20`).
- **Framework:** Spring Boot `3.2.5` (BOM en `nexabank/pom.xml:26`).
- **Build:** Maven multi-módulo; módulo único activo `nexabank-api`
  (`nexabank/pom.xml:15-17`). El módulo `nexabank-api/pom.xml` declara:
  `spring-boot-starter-web`, `spring-boot-starter-validation`, `spring-boot-starter-security`,
  `spring-boot-starter-hateoas`, `spring-boot-starter-actuator`, `firebase-admin:9.2.0`, `lombok:1.18.32`.
- **Sin springdoc/swagger** — no hay dependencia `springdoc-openapi` en ningún `pom.xml` del proyecto
  (`nexabank-api/pom.xml:21-76`, confirmado por búsqueda global). No existe documentación OpenAPI/Swagger.
- **Persistencia:** Firebase Firestore (NoSQL), sin base de datos relacional. No hay JPA/Hibernate.
- **Paquetes principales** bajo `src/main/java/com/nexabank/api/`:
  `controller`, `service`, `repository`, `model`, `dto/*`, `mapper`, `security`, `config`, `exception`,
  `logic/algorithm`, `logic/structure` (estructuras de datos propias: `DoublyLinkedList`, `Stack`, `Queue`,
  usadas en `PendingTransferQueue`, ver `ENTREGA2_INFORME.md:80-82`).
- **Puerto / perfiles:** `server.port=${SERVER_PORT:8080}` y
  `spring.profiles.active=${SPRING_PROFILES_ACTIVE:dev}`
  (`src/main/resources/application.properties:5-6`). **No existen** archivos
  `application-dev.properties` ni `application-prod.properties` — solo hay un único
  `application.properties`, por lo que no hay separación real de configuración por entorno (ver
  "Riesgos" más abajo, CORS).
- **Variables de entorno referenciadas** (solo nombres, sin valores — `.env` leído únicamente para
  este propósito): `SERVER_PORT`, `SPRING_PROFILES_ACTIVE`, `FIREBASE_TYPE`, `FIREBASE_PROJECT_ID`,
  `FIREBASE_PRIVATE_KEY_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_CLIENT_ID`,
  `FIREBASE_AUTH_URI`, `FIREBASE_TOKEN_URI`, `FIREBASE_AUTH_PROVIDER_X509_CERT_URL`,
  `FIREBASE_CLIENT_X509_CERT_URL`, `FIREBASE_UNIVERSE_DOMAIN`, `FIREBASE_STORAGE_BUCKET`.

## Autenticación y seguridad

- **Mecanismo:** Firebase Authentication — ID Token verificado con el Admin SDK
  (`FirebaseAuthenticationFilter.java:58`, `firebaseAuth.verifyIdToken(token)`). El filtro
  (`OncePerRequestFilter`) solo actúa si llega un header `Authorization: Bearer <token>`; si el token es
  inválido simplemente limpia el `SecurityContext` y continúa la cadena sin bloquear la petición
  (`FirebaseAuthenticationFilter.java:76-79`).
- **Roles:** se extraen custom claims `roles` del token Firebase y se mapean a
  `ROLE_<rol>`; si no hay claim, se asigna `ROLE_USER` por defecto
  (`FirebaseAuthenticationFilter.java:88-103`). **No se usa `@PreAuthorize` ni `hasRole` en ningún
  controlador** (verificado por ausencia total de estas anotaciones en `controller/`), así que estos
  roles no tienen ningún efecto real de autorización.
- **Riesgo crítico de diseño:** `SecurityConfig.java:62-70` define las reglas de autorización así:
  ```java
  .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
  .requestMatchers("/api/v1/auth/**").permitAll()
  .requestMatchers(HttpMethod.POST, "/api/v1/seed").permitAll()
  .anyRequest().permitAll()
  ```
  La última línea (`anyRequest().permitAll()`) hace que **todas** las rutas —incluidas
  `/api/v1/transfers`, `/api/v1/accounts`, `/api/v1/admin/**`— sean accesibles sin ningún token válido a
  nivel de Spring Security. El propio comentario Javadoc de la clase (líneas 24-33) describe rutas
  "privadas" que en el código real no están protegidas. La única protección real es que cada
  controlador llama manualmente a `SecurityUtils.getCurrentUserId()`, que lanza
  `AuthenticationRequiredException` (401) si no hay `Authentication` válida en el contexto
  (`SecurityUtils.java:20-26`) — pero esto depende de que el desarrollador se acuerde de llamarlo en
  cada endpoint, y varios no lo hacen (ver sección "Endpoints" e IDOR en "Riesgos").
- **CORS:** `CorsConfig.java:16-33` permite el patrón de origen `"*"` junto con
  `http://localhost:*`, `https://*.ngrok-free.dev`, etc., y al mismo tiempo
  `configuration.setAllowCredentials(true)` (línea 27). Esta combinación (`*` + credentials) es
  contradictoria con la especificación CORS (los navegadores normalmente rechazan `*` con
  `credentials: true`, pero `setAllowedOriginPatterns` de Spring sí lo permite técnicamente, reflejando
  el origen real). No hay diferenciación por perfil (`dev` vs `prod`) porque no existen archivos
  `application-{profile}.properties`; la misma configuración wildcard se usaría en producción.
- **Sesiones:** `SessionCreationPolicy.STATELESS` (`SecurityConfig.java:58-59`), CSRF deshabilitado
  (línea 54) — correcto para una API stateless basada en tokens.
- **PIN de usuario:** se almacena en texto plano en el modelo `User.pin`
  (`model/User.java:60`) y se compara con `pin.equals(user.getPin())`
  (`AuthService.java:175`), sin hash (bcrypt/argon2) ni salteo. El valor también se persiste igual en
  Firestore (`UserRepository.java:178`, `map.put("pin", user.getPin())`).
- **Token de sesión "falso":** `AuthService.register()` y `AuthService.getCurrentUser()` devuelven un
  token sintético `"demo_token_" + userId` (`AuthService.java:153`, `190`) en lugar de un JWT o sesión
  real emitida por el backend. El frontend seguiría dependiendo exclusivamente del ID Token de Firebase
  para llamadas autenticadas; este campo `token` del `AuthResponse` no sirve como credencial real.

## Endpoints

| Método | Ruta | Auth (declarada / real) | Request | Response | Notas |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/phone/start` | Pública | `PhoneStartRequest{phone}` (`@Valid`) | `AuthResponse` | `AuthController.java:43-46` |
| POST | `/api/v1/auth/phone/verify` | Pública | `PhoneVerifyRequest{phone,code}` (`@Valid`) | `AuthResponse` | `AuthController.java:51-54`. El código OTP se loguea en claro (`AuthService.java:77`) |
| POST | `/api/v1/auth/register` | Pública | `RegisterRequest` (`@Valid`, con `@Pattern`/`@Size`) | `AuthResponse` (incluye `token` falso) | `AuthController.java:59-62` |
| POST | `/api/v1/auth/pin/setup` | Requiere header `Authorization` manual (no `@Valid`) | `PinSetupRequest{pin}` **sin validación** | `AuthResponse` | `AuthController.java:67-72`. PIN sin longitud/formato mínimo aquí (sí en `RegisterRequest`) |
| POST | `/api/v1/auth/pin/verify` | Igual que arriba | `PinVerifyRequest{pin}` | `AuthResponse` | `AuthController.java:77-82`. Comparación en texto plano |
| GET | `/api/v1/auth/me` | Header `Authorization` manual | — | `AuthResponse` con `UserResponse` | `AuthController.java:87-91` |
| GET | `/api/v1/auth/exists?phone=` | Pública | query `phone` | `{exists, phone}` | `AuthController.java:96-100`. Permite enumerar teléfonos registrados (sin rate limit) |
| POST | `/api/v1/auth/logout` | Pública (no invalida nada server-side) | — | `AuthResponse` | `AuthController.java:105-108` |
| GET | `/api/v1/users/me` | `SecurityUtils` (real, no Spring Security) | — | `UserResponse` | `UserController.java:23-28` |
| PUT | `/api/v1/users/me` | Igual | `UserUpdateRequest{displayName,phone}` sin `@Valid` en el controller (DTO sí tiene `@Size`, pero no se aplica porque falta `@Valid`) | `UserResponse` | `UserController.java:30-35` |
| GET | `/api/v1/accounts` | `SecurityUtils` | — | `List<AccountResponse>` | `AccountController.java:25-30` |
| GET | `/api/v1/accounts/{id}` | `SecurityUtils` + check ownership en service | path `id` | `AccountResponse` | `AccountController.java:32-37`; ownership validado en `AccountService.java:36-45` |
| POST | `/api/v1/accounts` | `SecurityUtils` | `CreateAccountRequest{type,currency,name}` sin `@Valid` en controller (DTO tiene `@NotBlank` pero no se aplica) | `AccountResponse` (201) | `AccountController.java:39-44` |
| GET | `/api/v1/transactions` | `SecurityUtils` solo si no se pasa `accountId` | query `accountId,userId,page,size` | `PageResponse<TransactionResponse>` | `TransactionController.java:32-44`. Paginación es **en memoria** sobre el listado completo (`PageResponse.of`), no cursor real de Firestore. `userId` puede pasarse como query param arbitrario cuando se da `accountId` — ver IDOR |
| GET | `/api/v1/transactions/{id}` | **Ninguna verificación de ownership** | path `id` | `TransactionResponse` | `TransactionController.java:46-50` → `TransactionService.getTransactionById` no recibe `userId` (IDOR, ver Riesgos) |
| POST | `/api/v1/transactions` | `SecurityUtils` | `CreateTransactionRequest` sin `@Valid` en controller (DTO tiene `@NotBlank`/`@Positive`) | `TransactionResponse` (201) | `TransactionController.java:52-57`. Actualiza balance con `accountRepository.updateBalance` fuera de transacción Firestore (ver Riesgos) |
| GET | `/api/v1/transfers` | `SecurityUtils` | — | `List<TransferResponse>` | `TransferController.java:38-43` |
| GET | `/api/v1/transfers/{id}` | **Ninguna verificación de ownership** | path `id` | `TransferResponse` | `TransferController.java:45-49` → `TransferService.getTransferById` no recibe `userId` (IDOR) |
| POST | `/api/v1/transfers` | `SecurityUtils` + ownership validado dentro del service | `CreateTransferRequest` (`@Valid`) + header `Idempotency-Key` (opcional) | `TransferResponse` (201) | `TransferController.java:51-58`. Idempotencia implementada (ver Modelos) |
| POST | `/api/v1/transfers/quote` | `SecurityUtils` + ownership | `CreateTransferRequest` (`@Valid`) | `QuoteResponse` | `TransferController.java:60-67` |
| POST | `/api/v1/transfers/{id}/cancel` | `SecurityUtils` + ownership validado (`sourceUserId`) | path `id` | `TransferResponse` | `TransferController.java:69-74`; ownership en `TransferService.cancelTransfer:450-452` |
| GET | `/api/v1/beneficiaries` | `SecurityUtils` | — | `List<BeneficiaryResponse>` | `BeneficiaryController.java:24-29` |
| GET | `/api/v1/beneficiaries/{id}` | `SecurityUtils` + ownership | path `id` | `BeneficiaryResponse` | `BeneficiaryController.java:31-36`; ownership en `BeneficiaryService.java:40-49` |
| POST | `/api/v1/beneficiaries` | `SecurityUtils` | `CreateBeneficiaryRequest` sin `@Valid` en controller (DTO con `@NotBlank`/`@Size`) | `BeneficiaryResponse` (201) | `BeneficiaryController.java:38-43` |
| PUT | `/api/v1/beneficiaries/{id}` | `SecurityUtils` + ownership | `UpdateBeneficiaryRequest` sin `@Valid` | `BeneficiaryResponse` | `BeneficiaryController.java:45-52` |
| DELETE | `/api/v1/beneficiaries/{id}` | `SecurityUtils` + ownership | path `id` | 204 No Content | `BeneficiaryController.java:54-59` |
| POST | `/api/v1/qr/pay` | **Ninguna validación de request**, auth vía `SecurityUtils` dentro del service | `QrPayRequest{qrData,amount:String,currency,description}` sin `@Valid` ni anotaciones de validación en el DTO | `Map<String,Object>` ad-hoc | `QrController.java:32-35`, `QrService.java:39-100`. `amount` es `String` parseado con `new BigDecimal(request.getAmount())` (línea 65) — puede lanzar `NumberFormatException` no controlada → 500. Mutación de balance sin transacción Firestore (Riesgo alto) |
| GET | `/api/v1/qr/decode?data=` | Pública (sin `SecurityUtils`) | query `data` | `Map<String,Object>` | `QrController.java:40-43` |
| GET | `/api/v1/fx/rates/{base}/{target}` | Pública (sin `SecurityUtils`) | path `base,target` | `ExchangeRateResponse` | `FxController.java:45-49` |
| POST | `/api/v1/fx/convert` | Pública | `ConvertCurrencyRequest` (`@Valid`) | `ConvertCurrencyResponse` | `FxController.java:51-55` |
| POST | `/api/v1/fx/quote` | `SecurityUtils` | `QuoteRequest` (`@Valid`) | `QuoteResponse` | `FxController.java:57-64` |
| GET | `/api/v1/admin/metrics` | **Sin verificación de rol real** (comentario dice "requiere ADMIN" pero no hay `@PreAuthorize`, y `SecurityConfig` permite todo) | — | `Map<String,Object>` (totales, incluye `totalVolume`) | `AdminController.java:32-35`, `AdminService.java:44-63` |
| GET | `/api/v1/admin/users` | Igual | — | `List<UserResponse>` | `AdminController.java:40-43` |
| GET | `/api/v1/admin/audit-events` | Igual | — | `List<Map<String,Object>>` | `AdminController.java:48-51` |
| POST | `/api/v1/seed` | **Pública explícita** (`SecurityConfig.java:66`) | — | `Map<String,Object>` | `SeedController.java:23-26`. Pobla la base de datos completa sin auth |
| DELETE | `/api/v1/seed/purge` | Sin regla explícita → cae en `anyRequest().permitAll()` | — | `Map<String,Object>` | `SeedController.java:28-31`. **Borra toda la base de datos sin autenticación real** |
| POST | `/api/v1/algorithms/sort` | `SecurityUtils` | `SortRequest` sin `@Valid` | `SortResponse` | `AlgorithmController.java:25-31`. Fuera de alcance bancario (demo académica) |
| POST | `/api/v1/algorithms/search` | `SecurityUtils` | `SearchRequest` sin `@Valid` | `SearchResponse` | `AlgorithmController.java:33-39` |
| GET | `/api/v1/benchmarks` | Pública | — | `List<BenchmarkRunResponse>` | `BenchmarkController.java:22-26` |
| GET | `/api/v1/benchmarks/{runId}` | Pública | path `runId` | `BenchmarkRunResponse` | `BenchmarkController.java:28-32` |
| GET | `/api/v1/benchmarks/{runId}/results` | Pública | path `runId` | `List<BenchmarkResultResponse>` | `BenchmarkController.java:34-38` |
| POST | `/api/v1/benchmarks/execute` | Pública | query `inputSize` | `BenchmarkRunResponse` (201) | `BenchmarkController.java:40-45` |

No hay prefijo de versión distinto a `/api/v1` — **sí existe versionado básico** (`/api/v1/...` en todos
los `@RequestMapping`), a diferencia de lo que a veces ocurre en proyectos sin esta práctica.

## Modelos de datos

- **`Account`** (`model/Account.java`): `id, userId, type, name, currency, balance:BigDecimal, status,
  createdAt, updatedAt`. Comentario explícito (líneas 29-30): "El balance se modifica ÚNICAMENTE
  mediante operaciones financieras válidas. Nunca confiar en un balance enviado por el cliente" — y en
  efecto, `CreateAccountRequest` no tiene campo `balance` (`dto/account/CreateAccountRequest.java:12-13`).
- **`Transaction`** (`model/Transaction.java`): `id, accountId, userId, type, category,
  amount:BigDecimal, currency, description, status, timestamp, createdAt`. Comentario: "nunca se debe
  borrar físicamente una transacción financiera completada" (líneas 17-18) — coincide con que
  `TransactionRepository` no expone ningún método `delete`.
- **`Transfer`** (`model/Transfer.java`): incluye `amount, destinationAmount, fee, fxRate, fxMargin`
  (todos `BigDecimal`), `status` (`PENDING→PROCESSING→COMPLETED/FAILED/CANCELLED`), `idempotencyKey`,
  `trackingNumber`, `recipientInfo`/`senderInfo` (mapas de texto).
- **`User`** (`model/User.java`): incluye `pin:String` en texto plano (línea 60) y comentario que dice
  "No almacenar contraseñas en Firestore si se utiliza Firebase Authentication" (línea 38) — contradicho
  por el propio campo `pin`, que sí se persiste.
- **`IdempotencyKey`** (`model/IdempotencyKey.java`): `key, userId, operation, requestHash, status,
  responseReference, expiresAt`. El campo `requestHash` existe en el modelo pero **no se usa** en
  `TransferService` (nunca se calcula ni se compara) — solo se verifica `key` + `status=="COMPLETED"`
  (`TransferService.java:142-152`), por lo que dos requests distintos con la misma `Idempotency-Key`
  pero payload diferente no se detectarían como conflicto.
- **`AuditLog`** (`model/AuditLog.java`): log de auditoría con `userId, action, resourceType,
  resourceId, status, timestamp, metadata`. Se usa consistentemente en `TransferService` y
  `TransactionService` tras cada operación financiera.
- **`Beneficiary`** (`model/Beneficiary.java`): soporta SWIFT/BIC, IBAN, país, banco — pensado para
  transferencias internacionales.

### Representación de dinero (hallazgo crítico — ver también "Riesgos")

En el **dominio Java** (`model/*.java`, DTOs) el dinero se modela correctamente con `java.math.BigDecimal`
(`Account.balance`, `Transaction.amount`, `Transfer.amount/fee/fxRate`, etc.). Sin embargo, en la capa de
**persistencia real hacia Firestore**, todos los repositorios convierten explícitamente a `double` antes
de escribir y leen con `doc.getDouble(...)`:

- `AccountRepository.java:79` → `"balance", newBalance.doubleValue()` (en `updateBalance`)
- `AccountRepository.java:142,151` → `sourceBalance.subtract(totalDebit).doubleValue()` /
  `destBalance.add(destinationAmount).doubleValue()` (dentro de la transacción atómica)
- `AccountRepository.java:201` → lectura: `doc.getDouble("balance")`
- `AccountRepository.java:215` → `accountToMap`: `account.getBalance().doubleValue()`
- `TransactionRepository.java:130,146` → mismo patrón para `amount`
- `TransferRepository.java:88,106` → mismo patrón para `amount`

Es decir: **el dato que realmente queda almacenado en Firestore es un IEEE-754 double**, no un decimal
exacto ni un entero en unidades menores (centavos). `BigDecimal` solo protege los cálculos dentro de un
mismo request en memoria (evita imprecisión durante sumas/restas de esa operación), pero en cuanto el
valor se relee desde Firestore en la siguiente petición (`BigDecimal.valueOf(doc.getDouble("balance"))`),
ya partió de un `double` potencialmente impreciso. Para montos bancarios reales esto puede producir
errores de redondeo acumulativos (ej. 0.1 + 0.2 ≠ 0.3 exacto en IEEE-754) tras muchas operaciones.

## Integración con Firebase

- **Producto:** Firestore (no Realtime Database) — `FirebaseConfig.java:166-168`,
  `@Bean public Firestore firestore() { return FirestoreClient.getFirestore(); }`.
- **Admin SDK:** inicializado en `FirebaseConfig.initialize()` (`@PostConstruct`,
  `FirebaseConfig.java:59-100`), que soporta credenciales desde un archivo classpath
  `firebase-service-account.json` o desde variables de entorno individuales (`FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, etc.), con fallback a parseo manual de un archivo
  `.env` (método `parseDotEnv`, líneas 191-207).
- **Colecciones Firestore identificadas** (por constante `COLLECTION` en cada repository):
  `accounts`, `transactions`, `transfers`, `users`, `idempotency_keys`, `beneficiaries`, `audit_logs`,
  `exchange_rates` (`ExchangeRateRepository`), más benchmarks.
- **Transacciones atómicas de Firestore:**
  - **Sí se usa** `firestore.runTransaction(...)` correctamente en
    `AccountRepository.transferBalance()` (`AccountRepository.java:119-157`): lee ambos documentos
    dentro de la transacción (`transaction.get(...)`), valida fondos suficientes dentro de la misma
    transacción (línea 132-137) y escribe ambos lados (`transaction.update(...)`) antes de retornar. Esto
    previene razas de doble gasto específicamente para transferencias cuenta-a-cuenta vía
    `/api/v1/transfers`.
  - **No se usa** en ningún otro flujo que mute balances:
    - `TransactionService.createTransaction()` (`TransactionService.java:74-124`): lee el balance con
      `accountRepository.findById` (fuera de transacción), calcula el nuevo balance en memoria, guarda la
      transacción y luego llama `accountRepository.updateBalance(...)` como una escritura independiente
      (línea 103) — **read-then-write sin transacción Firestore**, vulnerable a condición de carrera si
      dos requests concurrentes mutan el mismo account.
    - `QrService.processQrPayment()` (`QrService.java:39-100`): lee la cuenta (línea 55-57), compara
      balance (línea 66), y guarda con `sourceAccount.setBalance(...); accountRepository.save(sourceAccount)`
      (líneas 73-74) — **tampoco usa transacción Firestore**; `save()` simplemente sobrescribe el
      documento completo sin transacción, así que dos pagos QR simultáneos sobre la misma cuenta pueden
      pisarse (lost update / doble gasto).
- **Reglas de seguridad de Firestore:** no existe ningún archivo `firestore.rules` en el repositorio
  (búsqueda `find ... -iname "*.rules"` sin resultados en todo `NexaBank-Backend` ni `NexaBank API`). No
  se puede confirmar si el proyecto depende de reglas de seguridad de Firestore del lado del cliente
  (indicando que probablemente no hay cliente directo a Firestore desde el frontend — todo pasa por esta
  API —, pero no hay evidencia en este repo que lo garantice formalmente; es una suposición razonable, no
  confirmada).

## Manejo de errores

- **`@RestControllerAdvice` presente:** `GlobalExceptionHandler.java:17-84`, centraliza el manejo de
  excepciones.
- **Formato de error consistente** (`dto/common/ErrorResponse.java`):
  `{ timestamp, status, error, message, path, traceId }`, con `@JsonInclude(NON_NULL)`.
- **Excepciones de dominio mapeadas explícitamente:**
  - `ResourceNotFoundException` → 404 (`GlobalExceptionHandler.java:22-26`)
  - `AuthenticationRequiredException` → 401 (líneas 28-32)
  - `InsufficientFundsException` → 422 (líneas 34-38)
  - `InvalidTransactionException` → 400 (líneas 40-44)
  - `UnauthorizedOperationException` → 403 (líneas 46-50)
  - `MethodArgumentNotValidException` (Bean Validation) → 400, con el primer error de campo
    (líneas 52-59)
  - `IllegalArgumentException` → 400 (líneas 61-65)
  - `Exception` genérica → 500, **pero incluye `ex.getMessage()` en el campo `message` de la respuesta**
    (líneas 67-71, 73-83). No se envía el stack trace completo al cliente (solo se loguea
    server-side con `log.error("Internal server error: ", ex)`, línea 69), pero el mensaje crudo de la
    excepción sí llega al cliente — puede filtrar detalles internos (ej. mensajes de Firestore,
    `NullPointerException` referenciando nombres de campos internos) en el handler catch-all.
- No se identificaron excepciones específicas para `InvalidCurrencyException`,
  `UnsupportedCurrencyException` ni `QuoteExpiredException` en `GlobalExceptionHandler` — estas clases
  existen en `exception/` pero no tienen un `@ExceptionHandler` dedicado, así que caerían en el handler
  genérico de `Exception` (500) en lugar de un código 4xx más preciso. **Esto es una inconsistencia**: por
  ejemplo, lanzar `InvalidCurrencyException` desde `TransferService.java:101` o `TransferService.java:182`
  resultaría en un 500 en vez de un 400, porque no hay `@ExceptionHandler(InvalidCurrencyException.class)`.

## Validación

Bean Validation (`jakarta.validation`) está en el classpath (`spring-boot-starter-validation`), y varios
DTOs declaran anotaciones (`@NotBlank`, `@Positive`, `@Size`, `@Pattern`, `@Email`). Sin embargo, la
anotación `@Valid` en el método del controlador es indispensable para que esas reglas se evalúen — y
**falta en varios endpoints** que sí tienen anotaciones en el DTO (por lo tanto esas validaciones nunca
se ejecutan en runtime):

- `AccountController.createAccount` (`AccountController.java:40`) — `CreateAccountRequest` tiene
  `@NotBlank` pero falta `@Valid`.
- `TransactionController.createTransaction` (`TransactionController.java:53`) — `CreateTransactionRequest`
  tiene `@NotBlank`/`@Positive` pero falta `@Valid`.
- `BeneficiaryController.createBeneficiary` / `updateBeneficiary`
  (`BeneficiaryController.java:39`, `48`) — DTOs con `@NotBlank`/`@Size` pero sin `@Valid`.
- `UserController.updateCurrentUser` (`UserController.java:31`) — `UserUpdateRequest` tiene `@Size` pero
  falta `@Valid`.
- `AuthController.setupPin` / `verifyPin` (`AuthController.java:68-72`, `78-82`) — y además el propio DTO
  `PinSetupRequest`/`PinVerifyRequest` **no tiene ninguna anotación de validación** (sin `@NotBlank`,
  sin `@Pattern` de dígitos, sin `@Size`), así que un PIN vacío o de cualquier longitud pasaría.
- `QrController.pay` (`QrController.java:33`) — `QrPayRequest` no tiene ninguna anotación de validación;
  `amount` es `String` sin `@Pattern`/`@NotBlank`, y se parsea directamente con `new BigDecimal(...)` en
  el service sin manejo de `NumberFormatException`.
- `AlgorithmController.executeSort` / `executeSearch` (`AlgorithmController.java:26`, `34`) — sin `@Valid`
  (fuera de alcance financiero).

Endpoints que **sí** aplican `@Valid` correctamente: `AuthController` (`phone/start`, `phone/verify`,
`register`), `TransferController` (`createTransfer`, `quoteTransfer`), `FxController` (`convert`,
`quote`).

## Documentación de API

No hay springdoc-openapi ni Swagger UI configurado — ninguna dependencia `springdoc` en `pom.xml`, ningún
paquete `io.swagger`/`springdoc` en el código, y ningún endpoint `/swagger-ui` o `/v3/api-docs` definido.
La única documentación de endpoints es el Javadoc manual en cada controlador (p. ej.
`AuthController.java:16-29`, `TransferController.java:14-25`, `FxController.java:18-27`).

## Tests existentes

613 líneas de test en total, repartidas en:

- **Controladores (`@WebMvcTest` + Mockito):** `TransferControllerTest` (crear transferencia feliz
  path), `BeneficiaryControllerTest`, `FxControllerTest` — cobertura superficial de happy-path + algunos
  casos de error, usando mocks de `SecurityUtils` y los services.
- **Servicios:** `TransferServiceTest` (248 líneas — el más completo, cubre fee/fx/ownership),
  `FeeServiceTest`, `FxServiceTest`.
- **Estructuras de datos académicas:** `DoublyLinkedListTest`, `StackTest`, `QueueTest`,
  `RecursiveAlgorithmsTest` — con autoría cruzada documentada en `ENTREGA2_INFORME.md:126-146`.

**No se encontraron tests** para: `AccountController`/`AccountService`, `TransactionController`/
`TransactionService`, `UserController`/`UserService`, `AuthController`/`AuthService`,
`AdminController`/`AdminService`, `QrController`/`QrService`, `SecurityConfig`/`FirebaseAuthenticationFilter`,
ni ningún test de integración end-to-end contra Firestore (emulador o real). No hay tests que verifiquen
el comportamiento de IDOR, idempotencia duplicada, ni condiciones de carrera en balances.

## Riesgos encontrados (Alta / Media / Baja)

### Alta

1. **Autorización no aplicada a nivel de framework (bypass total potencial).**
   `SecurityConfig.java:69` — `.anyRequest().permitAll()`. Spring Security no exige token en ningún
   endpoint; toda la protección depende de que cada controlador recuerde llamar a
   `SecurityUtils.getCurrentUserId()`. Esto ya falla en los puntos #2 y #7 de esta lista. Cualquier
   endpoint nuevo que un desarrollador olvide proteger manualmente queda abierto por defecto.

2. **IDOR en lectura de transacciones y transferencias por ID.**
   - `TransactionController.getTransaction(@PathVariable String id)`
     (`TransactionController.java:46-50`) llama a `transactionService.getTransactionById(id)`
     (`TransactionService.java:58-62`) sin pasar ni comprobar `userId` — cualquier usuario autenticado (o,
     dado el riesgo #1, cualquier request) puede leer la transacción de cualquier otro usuario adivinando
     o enumerando IDs (`TX-000001`, `TX-000002`, ... son secuenciales/pseudoaleatorios de 6 dígitos,
     `TransactionRepository.java:118-121`).
   - `TransferController.getTransfer(@PathVariable String id)` (`TransferController.java:45-49`) →
     `TransferService.getTransferById` (`TransferService.java:82-86`) tiene el mismo problema: no valida
     `sourceUserId`/`destinationUserId` contra el usuario autenticado, exponiendo montos, fees, FX rate y
     datos de remitente/destinatario de transferencias de terceros.

3. **Mutación de balance sin transacción Firestore en dos flujos financieros.**
   - `QrService.processQrPayment()` (`QrService.java:39-100`, especialmente líneas 55-74): lee la cuenta,
     compara balance, resta en memoria y hace `accountRepository.save(sourceAccount)` (sobrescritura
     completa del documento) sin `runTransaction`. Dos pagos QR concurrentes sobre la misma cuenta pueden
     producir un "lost update": ambos leen el mismo balance inicial y el segundo `save()` pisa el
     resultado del primero, permitiendo gastar más saldo del disponible.
   - `TransactionService.createTransaction()` (`TransactionService.java:82-103`): mismo patrón
     read-then-write (`accountRepository.findById` + `accountRepository.updateBalance` como llamadas
     separadas, sin transacción atómica), aplicable a cualquier `POST /api/v1/transactions` con
     `type=EXPENSE` o `INCOME`.
   - Contraste: `TransferService` (transferencias cuenta-a-cuenta) sí está protegido correctamente vía
     `AccountRepository.transferBalance()` con `firestore.runTransaction(...)`
     (`AccountRepository.java:116-164`).

4. **PIN almacenado y verificado en texto plano.**
   `model/User.java:60` (campo `pin`), persistido literal en Firestore
   (`UserRepository.java:178`), comparado con `pin.equals(user.getPin())`
   (`AuthService.java:175`). Cualquier acceso de lectura a la colección `users` (ej. por un bug de
   autorización, un backup mal protegido, o acceso directo a Firestore) expone PINs de todos los
   usuarios en claro. Debería hashearse (bcrypt/argon2) igual que una contraseña.

5. **Dinero persistido como `double` IEEE-754 en Firestore**, pese a usar `BigDecimal` en memoria.
   Ver detalle en "Modelos de datos" (`AccountRepository.java:79,142,151,201,215`;
   `TransactionRepository.java:130,146`; `TransferRepository.java:88,106`). Riesgo de errores de
   redondeo acumulativos en operaciones financieras reales a través de múltiples lecturas/escrituras.

6. **Endpoints destructivos sin autenticación real.**
   `POST /api/v1/seed` está explícitamente en la whitelist pública de `SecurityConfig.java:66`, y
   `DELETE /api/v1/seed/purge` (`SeedController.java:28-31`, borra la base completa vía
   `DataPurgeService.purgeDatabase()`) no tiene regla explícita, por lo que cae en el
   `anyRequest().permitAll()` general — también accesible sin ningún token. En conjunto, cualquiera con
   la URL puede repoblar o **purgar completamente** la base de datos de producción.

7. **Rol de administrador sin aplicación real.**
   `AdminController` expone métricas globales, lista de todos los usuarios y eventos de auditoría
   (`AdminController.java:32-51`). El Javadoc dice "Todas las rutas requieren rol ADMIN" (línea 15), pero
   no hay `@PreAuthorize("hasRole('ADMIN')")` ni ninguna comprobación de rol en el controller o el
   service (`AdminService.java`), y `SecurityConfig` permite todo. Cualquier usuario autenticado (o no
   autenticado, dado el riesgo #1) puede listar todos los usuarios del sistema.

### Media

8. **CORS con wildcard `*` + `allowCredentials(true)`, sin distinción de perfil.**
   `CorsConfig.java:18,27`. No existen `application-dev.properties`/`application-prod.properties`
   separados (confirmado: solo existe `application.properties`), así que esta configuración se aplicaría
   igual en un despliegue de producción salvo que se reescriba explícitamente.

9. **Falta `@Valid` en varios endpoints con DTOs validados** (detalle completo en sección
   "Validación"): `POST /api/v1/accounts`, `POST /api/v1/transactions`, `POST`/`PUT /api/v1/beneficiaries`,
   `PUT /api/v1/users/me`. Las anotaciones Bean Validation presentes en esos DTOs son actualmente
   ineficaces.

10. **`PinSetupRequest`/`PinVerifyRequest`/`QrPayRequest` sin ninguna anotación de validación**, ni
    `@Valid` en el controlador. Un PIN vacío, de un solo carácter, o con caracteres no numéricos sería
    aceptado por `/api/v1/auth/pin/setup`. `QrPayRequest.amount` es `String` libre, parseado con
    `new BigDecimal(...)` sin captura de `NumberFormatException` (`QrService.java:65`) → un valor no
    numérico produciría un 500 genérico en vez de un 400 claro.

11. **Idempotencia incompleta: no valida el contenido del request, solo la clave.**
    `TransferService.executeTransfer()` (líneas 142-152) solo comprueba si la `Idempotency-Key` ya existe
    y está `COMPLETED`; el campo `requestHash` del modelo `IdempotencyKey` nunca se calcula ni compara. Un
    cliente que reutilice la misma `Idempotency-Key` con un payload *distinto* (otro monto, otra cuenta
    destino) recibiría silenciosamente la respuesta de la transferencia original en lugar de un error de
    conflicto — riesgo de confusión, aunque no de doble cobro.

12. **Error 500 genérico filtra el mensaje crudo de la excepción al cliente.**
    `GlobalExceptionHandler.handleGeneral()` (líneas 67-71) incluye `ex.getMessage()` en el campo
    `message` de la respuesta JSON para cualquier excepción no mapeada explícitamente. No se envía stack
    trace, pero sí texto de error interno (p. ej. mensajes de Firestore o NPEs).

13. **Excepciones de dominio sin `@ExceptionHandler` dedicado caen en 500 en vez de 4xx.**
    `InvalidCurrencyException`, `UnsupportedCurrencyException`, `QuoteExpiredException` no tienen entrada
    en `GlobalExceptionHandler` — por ejemplo, un mismatch de moneda en una transferencia
    (`TransferService.java:181-191`) devolvería 500 en lugar de 400/422.

14. **Enumeración de usuarios por teléfono sin rate limiting.**
    `GET /api/v1/auth/exists?phone=` (`AuthController.java:96-100`) es pública y devuelve directamente
    `{exists: true/false}` — permite enumerar qué números de teléfono están registrados mediante fuerza
    bruta, sin ningún límite de tasa.

15. **Código OTP logueado en texto claro a nivel INFO.**
    `AuthService.java:77` — `log.info("Verifying phone: {} with code: {}", phone, code)`. Con
    `logging.level.com.nexabank=DEBUG` activo (`application.properties:31`), este código queda en los
    logs de la aplicación (consola/archivo), accesible a cualquiera con acceso a esos logs.

16. **Paginación de transacciones no es un cursor real de Firestore.**
    `TransactionController.getTransactions()` (líneas 32-44) trae **todas** las transacciones del usuario
    o cuenta desde Firestore (`transactionRepository.findByAccountId`/`findByUserId`, sin `limit`/
    `startAfter`) y luego pagina en memoria con `PageResponse.of()` (`PageResponse.java:23-35`,
    `subList` sobre la lista completa). Esto no escala: con historiales grandes, cada página igual
    descarga y procesa el dataset completo desde Firestore.

### Baja

17. **No hay rate limiting en ningún endpoint** (login/OTP/PIN/transferencias). No se encontró ningún
    filtro, interceptor, ni dependencia (Bucket4j, Resilience4j, etc.) relacionado con límite de tasa en
    todo el proyecto.

18. **Generación de IDs con `Math.random()`** en varios repositorios (`AccountRepository.java:189-192`,
    `TransactionRepository.java:118-121`, `IdempotencyRepository.java:48`, `TransferRepository.java:76-79`)
    — IDs de 6 dígitos con posibilidad de colisión (no se verifica unicidad antes de `set()`, que
    sobrescribiría silenciosamente un documento existente con el mismo ID generado).

19. **Actuator expone `/actuator/health` públicamente** (`SecurityConfig.java:64`) con
    `management.endpoint.health.show-details=when-authorized` (`application.properties:20`) — razonable,
    pero conviene confirmar en el frontend que no se espera consumir detalles de health sin autenticar.

## Gaps frente al frontend (endpoints que el front necesita y no existen)

```
AUTH:
  POST /api/v1/auth/register              → EXISTS (AuthController.java:59-62, mismo path y método)
  POST /api/v1/auth/verify-otp             → PARTIAL — existe como POST /api/v1/auth/phone/verify
                                              (AuthController.java:51-54), nombre de ruta distinto
  POST /api/v1/auth/pin                    → PARTIAL — existe como POST /api/v1/auth/pin/setup
                                              (AuthController.java:67-72), nombre de ruta distinto
  POST /api/v1/auth/pin/verify             → EXISTS (AuthController.java:77-82, mismo path)

USUARIO:
  GET  /api/v1/me                          → PARTIAL — existe como GET /api/v1/users/me
                                              (UserController.java:23-28) y también GET /api/v1/auth/me
                                              (AuthController.java:87-91, devuelve AuthResponse, no UserResponse directo)
  PATCH /api/v1/me                         → PARTIAL — existe como PUT /api/v1/users/me
                                              (UserController.java:30-35); método PUT, no PATCH, y sin @Valid
  GET/POST /api/v1/me/kyc                  → MISSING — no existe ningún controller/service de KYC en todo el código
                                              (sin carpeta ni clase "kyc" en controller/service/model/dto)
  GET  /api/v1/me/devices                  → MISSING — no hay modelo ni endpoint de dispositivos
  DELETE /api/v1/me/devices/{id}           → MISSING

WALLET:
  GET  /api/v1/wallets                     → PARTIAL — el concepto equivalente es GET /api/v1/accounts
                                              (AccountController.java:25-30); naming distinto ("wallet" vs "account")
  GET  /api/v1/wallets/{id}                → PARTIAL — equivalente GET /api/v1/accounts/{id}
                                              (AccountController.java:32-37)
  GET  /api/v1/wallets/{id}/balance        → MISSING — no hay endpoint dedicado a balance; el balance
                                              viaja embebido en AccountResponse.balance (dto/account/AccountResponse.java:27)

TRANSACCIONES:
  GET  /api/v1/transactions (cursor/limit/type/status/from/to/q) → PARTIAL — existe GET /api/v1/transactions
                                              (TransactionController.java:32-44) pero solo soporta
                                              accountId/userId/page/size; NO soporta cursor, type, status,
                                              from/to ni búsqueda de texto (q). Paginación es en memoria, no cursor real
  GET  /api/v1/transactions/{id}           → EXISTS (TransactionController.java:46-50), pero con IDOR (ver Riesgos #2)
  POST /api/v1/transfers (Idempotency-Key, X-Confirmation-Token) → PARTIAL — existe POST /api/v1/transfers
                                              con soporte real de header Idempotency-Key
                                              (TransferController.java:51-58, TransferService.java:140-152);
                                              NO existe soporte para header X-Confirmation-Token (no se encontró
                                              ninguna referencia a "Confirmation" en todo el código)
  POST /api/v1/topups                      → MISSING — no existe controller/service de recargas ("topup"/"recarga")
  POST /api/v1/withdrawals                 → MISSING — no existe controller/service de retiros ("withdrawal"/"retiro")
  POST /api/v1/payments/qr                 → PARTIAL — existe como POST /api/v1/qr/pay (QrController.java:32-35),
                                              path distinto y sin @Valid (ver Riesgos #10)
  POST /api/v1/payment-requests            → MISSING — no existe concepto de "solicitud de pago" en el código

CONTACTOS:
  GET/POST /api/v1/contacts                → PARTIAL — el concepto equivalente es
                                              GET/POST /api/v1/beneficiaries (BeneficiaryController.java:24-29,38-43);
                                              naming distinto y modelo orientado a transferencias internacionales
                                              (SWIFT/IBAN), no a "contactos" simples
  GET  /api/v1/recipients/lookup           → MISSING — no existe endpoint de búsqueda/lookup de destinatarios
                                              por alias/teléfono/email

TARJETAS:
  GET/POST /api/v1/cards                   → MISSING — no existe ningún controller/service/model "card"/"tarjeta"
                                              en todo el código fuente
  PATCH /api/v1/cards/{id}                 → MISSING

NOTIFICACIONES:
  GET  /api/v1/notifications               → MISSING — no existe ningún controller/service/model de notificaciones
  PATCH /api/v1/notifications/{id}/read    → MISSING
```

### Resumen de cobertura frente al contrato objetivo

- **EXISTS** (ruta y método ya coinciden o son equivalentes directos): 3 de 24 ítems del contrato.
- **PARTIAL** (funcionalidad existe pero con naming, método HTTP, parámetros de filtrado o headers
  distintos/incompletos): 9 de 24 ítems.
- **MISSING** (sin ningún código relacionado en el backend): 12 de 24 ítems — KYC completo, gestión de
  dispositivos, balance dedicado por wallet, topups, withdrawals, payment-requests, recipients/lookup,
  tarjetas (CRUD completo) y notificaciones (CRUD completo).

El backend actual cubre razonablemente bien el núcleo de **auth por teléfono+PIN, cuentas, transacciones,
transferencias internacionales con FX/fees, beneficiarios y QR**, pero carece por completo de **KYC,
tarjetas, notificaciones, topups/withdrawals, payment-requests, gestión de dispositivos y balance
dedicado por wallet** — todos estos deberán construirse desde cero o acordarse como fuera de alcance antes
de iniciar el frontend PWA.
