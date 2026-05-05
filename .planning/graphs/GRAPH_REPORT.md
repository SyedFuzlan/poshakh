# Graph Report - poshakh  (2026-04-30)

## Corpus Check
- 93 files · ~1,146,985 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 212 nodes · 205 edges · 13 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `getRedisClient()` - 13 edges
2. `handleError()` - 11 edges
3. `POST()` - 8 edges
4. `POST()` - 7 edges
5. `read()` - 7 edges
6. `setOtp()` - 7 edges
7. `POST()` - 6 edges
8. `POST()` - 6 edges
9. `POST()` - 6 edges
10. `POST()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `sendSmsOtp()`  [INFERRED]
  backend\src\api\store\auth\forgot-password\route.ts → backend\src\lib\sms.ts
- `POST()` --calls--> `sendPasswordResetEmail()`  [INFERRED]
  backend\src\api\store\auth\forgot-password\route.ts → backend\src\lib\email.ts
- `POST()` --calls--> `handleError()`  [INFERRED]
  backend\src\api\store\auth\forgot-password\route.ts → backend\src\lib\handle-error.ts
- `POST()` --calls--> `handleError()`  [INFERRED]
  frontend\src\app\api\auth\login\route.ts → backend\src\lib\handle-error.ts
- `POST()` --calls--> `createSignedCookie()`  [INFERRED]
  frontend\src\app\api\auth\login\route.ts → frontend\src\lib\session.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.24
Nodes (13): POST(), attemptsKey(), clearAttempts(), deleteOtp(), getOtp(), incrementAttempts(), isRateLimited(), otpKey() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (8): AppError, AuthError, ConflictError, ForbiddenError, NotFoundError, PaymentError, RateLimitError, ValidationError

### Community 2 - "Community 2"
Cohesion: 0.2
Nodes (7): POST(), getRazorpay(), POST(), handleError(), POST(), verifySignature(), POST()

### Community 3 - "Community 3"
Cohesion: 0.35
Nodes (8): hasPassword(), key(), read(), setEmailVerified(), setPasswordHash(), verifyPassword(), write(), POST()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (7): getResend(), sendOtpEmail(), sendPasswordResetEmail(), sendSmsOtp(), sendViaFast2SMS(), sendViaMSG91(), POST()

### Community 5 - "Community 5"
Cohesion: 0.24
Nodes (4): handleQtyChange(), handleRemove(), removeMedusaLineItem(), updateMedusaLineItem()

### Community 6 - "Community 6"
Cohesion: 0.31
Nodes (5): handleLogin(), handleSignup(), onSuccess(), loginWithPassword(), signupWithPassword()

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (4): createSignedCookie(), verifySignedCookie(), GET(), POST()

### Community 8 - "Community 8"
Cohesion: 0.32
Nodes (5): generateStaticParams(), ProductDetailPage(), getProductById(), getProducts(), mapProduct()

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (2): initDb(), persist()

### Community 12 - "Community 12"
Cohesion: 0.83
Nodes (3): formatINR(), formatOrder(), toIST()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (1): GET()

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (1): createTestProduct()

## Knowledge Gaps
- **Thin community `Community 10`** (4 nodes): `initDb()`, `db.js`, `persist()`, `toParamArray()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (3 nodes): `route.ts`, `route.ts`, `GET()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (3 nodes): `create-test-product.js`, `create-test-product.ts`, `createTestProduct()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `handleError()` connect `Community 2` to `Community 0`, `Community 3`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `getRedisClient()` connect `Community 0` to `Community 2`, `Community 3`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `POST()` connect `Community 7` to `Community 0`, `Community 2`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `getRedisClient()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`getRedisClient()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `handleError()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`handleError()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `POST()` (e.g. with `isRateLimited()` and `setPasswordHash()`) actually correct?**
  _`POST()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `POST()` (e.g. with `incrementAttempts()` and `deleteOtp()`) actually correct?**
  _`POST()` has 6 INFERRED edges - model-reasoned connections that need verification._