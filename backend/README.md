# SellerShield AI API

Node.js and Express API for the SellerShield React app. It uses MongoDB/Mongoose, JWT sessions, Groq local tool calling, and PayPal Orders v2.

## Run locally

Requirements: Node.js 20+, MongoDB 6+ (local or Atlas), and sandbox credentials for external integrations.

```powershell
# From the workspace root:
npm install
Copy-Item backend/.env.example backend/.env
# Edit backend/.env, then:
npm run api:dev
```

The API listens on `http://localhost:5000`; health check: `GET http://localhost:5000/health`.

## Configure services

1. **MongoDB:** Set `MONGODB_URI` to a local database URL or an Atlas connection string.
2. **JWT:** Set `JWT_SECRET` to a unique random value of at least 32 characters. Never commit `.env`.
3. **Groq:** Create an API key and set `GROQ_API_KEY`. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`, which supports local tool calling and JSON structured responses on Groq. Shopping chat fails clearly if no key is configured; refund analysis reports a rules-based/manual-review source when Groq is unavailable. Set `INR_PER_USD_RATE` to an explicitly maintained positive INR-per-USD conversion rate to search USD-priced catalog products using INR budgets; without it, the assistant asks for a USD budget rather than guessing.
4. **PayPal sandbox:** Create a REST app in the PayPal Developer Dashboard. Set its client ID and secret, and keep `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`. Add the deployed HTTPS webhook URL `/api/paypal/webhook` and subscribe to `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED` (or `PAYMENT.CAPTURE.DECLINED`), `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.REFUND.PENDING`, and `PAYMENT.REFUND.FAILED`. Set the generated webhook ID in `PAYPAL_WEBHOOK_ID`. The secret is only used on the server.
5. **CORS:** `CORS_ORIGINS` is a comma-separated allowlist. For local Vite, use `http://localhost:5173`.

PayPal create and capture use the Orders v2 API. The server calculates the price from MongoDB, reserves stock, checks capture status, amount, and currency, and stores the capture before marking an order paid. Duplicate capture and refund requests use PayPal request IDs and guarded database state transitions. A webhook is applied only after PayPal's webhook verification endpoint returns `SUCCESS`.

## Seed sample catalog

Set `SELLER_SEED_EMAIL` and `SELLER_SEED_PASSWORD` in `backend/.env` (password at least 8 characters), then run from the workspace root:

```powershell
npm run api:seed
```

This creates the seller account if necessary and inserts six sample products idempotently. Passwords are hashed with bcrypt.

## API reference

All API paths below are relative to `/api`. Protected calls require `Authorization: Bearer <JWT>`. Successful responses are JSON; errors use `{ "message": "..." }`.

| Method | URL | Access | Request / behavior |
|---|---|---|---|
| POST | `/auth/register` | Public | `{name,email,password,role?}`. Role is `customer` or `seller`; returns `{token,user}`. |
| POST | `/auth/login` | Public | `{email,password}`. Returns `{token,user}`. |
| GET | `/auth/me` | Signed in | Returns the current public user. |
| GET / PUT | `/settings` | Seller | Get or update profile, store details, and return policy. |
| GET | `/products?q=&category=&maxPrice=&sellerId=` | Public | Returns active catalog products; filters are optional. |
| GET | `/products/:id` | Public | Returns one active product. |
| POST | `/products` | Seller | `{name,description,price,category,image,stock}`. Seller ID comes from the JWT. |
| PUT | `/products/:id` | Owning seller | Updates allowed product fields; ownership is enforced. |
| DELETE | `/products/:id` | Owning seller | Archives the product (`isActive=false`). |
| GET / PUT | `/cart` | Customer | Read or replace `{items:[{productId,quantity}]}`. Prices are read from products. |
| GET | `/orders` | Signed in | Customer sees own orders; seller sees orders containing their products. |
| GET | `/orders/:id` | Owner / seller | Returns an authorized order. |
| POST | `/orders` | Customer | Creates an internal order using database prices. Use PayPal create for payment checkout. |
| PATCH | `/orders/:id/status` | Seller | `{status:"processing"|"shipped"|"delivered"|"cancelled"}` for an order in that store. |
| POST | `/ai/chat` | Signed in | `{message,conversationId?}`. Returns a structured `type`, `data`, and compatibility `reply`/`products` fields. Server owns history and executes registered catalog/order/cart tools. |
| GET | `/ai/conversations` | Signed in | Lists the current user's recent conversations. |
| POST | `/ai/refund/analyze` | Customer | `{orderId,reason,evidence?}`. Verifies order ownership, capture, delivery state, and seller policy; returns `FULL_REFUND`, `PARTIAL_REFUND`, `MANUAL_REVIEW`, or `NOT_ELIGIBLE`. It never authorizes a refund. |
| GET | `/ai/business-insights?range=7d\|30d\|90d` | Seller | Uses MongoDB aggregates as the only source of business metrics, then asks Groq for evidence-linked summaries. Returns an explicit insufficient-data result when no verified captures exist. |
| POST | `/payments/paypal/create` | Customer | `{items:[{productId,quantity}],shipping}`; ignores client totals and returns PayPal order ID and approval URL. |
| POST | `/payments/paypal/capture` | Customer | `{paypalOrderId}`; captures server-side and marks paid only after verification. |
| POST | `/paypal/create-order` | Customer | Alias for the PayPal create endpoint. |
| POST | `/paypal/capture-order/:orderId` | Customer | Alias for capture; path ID is the PayPal order ID. |
| GET | `/transactions` | Signed in | Seller sees own-store payments; customer sees own payments. |
| POST | `/refunds` | Customer | `{orderId,reason,evidence?}`. Creates a request and AI recommendation, not approval. |
| GET | `/refunds` | Signed in | Seller sees store requests; customer sees own requests. Optional `?status=pending`. |
| PATCH | `/refunds/:id` | Seller | `{decision:"approved"|"rejected"}`. Approval calls PayPal's refund API; duplicate processing is blocked. |
| GET | `/analytics/overview` | Seller | Analytics payload used by the frontend dashboard. |
| GET | `/dashboard/analytics` | Seller | Alias for dashboard analytics. |
| POST | `/paypal/webhook` | PayPal signature | Verifies the event with PayPal before idempotent payment/refund updates. `/webhooks/paypal` is an alias. |

### Example requests (PowerShell)

```powershell
$api = 'http://localhost:5000/api'
$login = Invoke-RestMethod -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (@{ email='seller@example.com'; password='your-password' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Uri "$api/products?category=Home%20%26%20Living&maxPrice=50" -Headers $headers
Invoke-RestMethod -Method Post -Uri "$api/ai/chat" -Headers $headers -ContentType 'application/json' -Body (@{ message='Find me a gift under $50' } | ConvertTo-Json)
```

## AI tool safety

The Groq local tool loop is bounded to four model rounds, five tools per round, a 30-second model request timeout, and an eight-second tool timeout. Tool names map to an explicit backend registry; arguments are parsed and checked; product, order, and policy facts come from MongoDB with authorization applied. The model cannot call PayPal, update orders, approve refunds, or execute arbitrary code. AI refund output is only a recommendation, and seller approval re-checks payment, capture, delivery, remaining amount, and policy before invoking PayPal.

## Frontend connection

The frontend default `VITE_API_URL` is `http://localhost:5000/api`, matching this server. Set `VITE_PAYPAL_CLIENT_ID` in `frontend/.env` to the matching sandbox client ID. Never put the PayPal secret or Groq key in frontend environment variables.

## Operational notes

- Catalog and analytics use live MongoDB records; no successful payment data is seeded.
- Checkout reserves inventory before PayPal approval. Failed create/capture and denied captures release the reservation. A background job releases reservations for abandoned pending approvals after 120 minutes; multi-instance deployments should move this cleanup to a distributed scheduler.
- MVP checkout allows products from one seller per PayPal order; mixed-seller carts are rejected because split payouts are not configured.
- Deploy the webhook over HTTPS, and keep its webhook ID matched to the active PayPal app/environment.
- Configure backups, monitoring, and a production secret manager before handling live payments or customer data.
