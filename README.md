# Inventory Management System — Complete Concept Guide

This file is a **textbook for THIS project**. It covers what the app is, how React and Node work here, what every folder/file is for, and the code ideas you should be able to explain in a viva.

---

## 1. What is this project?

A **full-stack shop OS**: store back-office, customer marketplace, online shops, and platform admin — in one repo.

**Full-stack** = three layers:

1. **Frontend (React + TypeScript + Vite + Tailwind)** — screens the user sees
2. **Backend (Node.js native HTTP, not Express)** — APIs, rules, JWT
3. **Database (MySQL)** — users, stores, products, sales, shop orders

**Who logs in where**

| Role | URL | Identifier |
|------|-----|------------|
| Store owner / manager / cashier | `/login` | **Username** + password (stores are created by super admin) |
| Marketplace customer | `/account/login`, `/register` | Email + password |
| Platform super admin | `/super/login` | Email + password |

**Public entry:** `http://localhost:5173/` redirects to **`/stores`** (marketplace). Each shop also has `/shop/:slug`.

**Store panel** (`/dashboard`, `/products`, …): inventory, POS-style sales, udhaar, expenses, staff. Rows are keyed by **tenant id** (the owner’s user id).

**Super admin** (`/super`): create/edit/deactivate/delete stores, view orders and platform deliveries.

Inventory and business rules below still apply to the store panel; marketplace checkout adds `shop_orders`, commission, and delivery-by store vs platform.

---

## Business rules

**Tenant.** Super admin creates each **Owner** (store). JWT payload includes `{ id, email, role, tenantId }`. `tenantId` is the owner’s id. Products, sales, and stock movements use `user_id = tenantId`.

**Cost vs sale price.** `products.price` is what the customer pays (`> 0`). `cost_price` is what the shop paid (`>= 0`). Selling below cost is allowed; profit can be negative (a loss).

**Sale snapshots.** A sale copies `unit_price`, `unit_cost`, `total_amount`, and `cost_amount` at that moment. Later price edits do not rewrite old profit. Hover-editing amount is a **revenue override** only.

**Gross profit.** Revenue = `SUM(sales.total_amount)`. COGS = `SUM(sales.cost_amount)`. Gross profit = revenue − COGS. **Net profit** = gross profit − expenses.

**Stock movements.** On-hand stock is not typed on the product row. Opening qty, stock in, sales, sale returns, damage, and adjust are rows in `stock_movements`. Cannot sell more than on-hand (`FOR UPDATE` in a transaction). Low stock threshold is set in Settings.

**Roles.** Owner: everything including staff. Manager: catalog, stock, sales, expenses, reports; no staff. Cashier: sales, customers, receipts.

**Invoices.** A sale can have multiple items. Snapshot prices still apply per line.

**Udhaar.** Optional customer on a sale. If paid < total, the remainder is customer balance. Collect later from Customers → Pay.

**Expenses and net profit.** Expenses reduce **net profit** (gross profit − expenses). Dashboard periods: Today, This week, This month, All time.

**Receipts.** Print a sale from the 3-dot menu.

**Safer login.** Access token lasts 15 minutes; refresh token lasts 7 days. The API sets **httpOnly cookies** and also returns tokens in JSON; the React app keeps token, refresh token, and user profile in **localStorage** for Bearer requests and refresh (`auth.ts` → `setupApi`).

---

## 2. Big picture (how a click becomes data)

```
User clicks / types
        |
        v
React page (JSX + useState)
        |
        v
Axios  →  Vite proxy /api  →  Node server.js
        |                         |
        |                         v
        |                   routes/  (URL + login check)
        |                         |
        |                         v
        |                   services/  (rules + SQL)
        |                         |
        |                         v
        |                      MySQL
        v
JSON comes back → setState → screen updates
```

**React never runs SQL.** Only the backend talks to MySQL. That is an exam point.

Two processes at once:

| App | Port | Role |
|-----|------|------|
| Vite + React | 5173 | UI |
| Node `http.createServer` | 5000 | APIs |

In development, `vite.config.ts` **proxies** `/api` to `5000`. Axios uses `API_URL` from `VITE_API_URL` (blank = same origin `/api/login`). The backend still sends **CORS** headers for cases without the proxy.

---

## 3. React concepts (using THIS code)

React is a **library for UI with components**. A component is a function that returns **JSX**.

### 3.1 Component, props, state

- **Props** = input from parent (`Sidebar` gets `onLogout`)
- **JSX** = output (what to draw)
- **State** = memory that can change (`useState`)

When state changes, React **re-renders** that component.

```tsx
const [email, setEmail] = useState("");
<input value={email} onChange={(e) => setEmail(e.target.value)} />
```

This is a **controlled input**: React state is the source of truth.

This project uses `useState` for: forms, lists, modals (`showAdd`), search text, pagination page, toasts, password show/hide, loading flags.

### 3.2 JSX details

```tsx
<h1 className="text-teal-800">Welcome Back</h1>
```

- `{ }` = JavaScript inside JSX
- `className` not `class` (`class` is reserved)
- `<>...</>` = fragment (group without extra HTML)

### 3.3 useEffect (after render)

Drawing UI is not enough. After the page appears, load data:

```tsx
useEffect(() => {
  void loadProducts();
}, [showToast]);
```

- First argument = function to run
- Second argument = **dependency array**
  - `[]` ≈ once on mount
  - `[showToast]` = run when that value changes

Skip the array and you can get an **infinite loop**.

Used here for: dashboard stats, product/sales lists, opening `?add=1` modal, Layout listening to name changes.

### 3.4 Conditional rendering and lists

```tsx
{showAdd ? <Modal>...</Modal> : null}
{product.stock < 3 ? <span>Low</span> : null}

products.map((product) => (
  <tr key={product.id}>...</tr>
))
```

`key` must be a real **id**, not the array index, because rows can be deleted.

### 3.5 Events

| Event | Where |
|--------|--------|
| `onSubmit` | forms (`event.preventDefault()` stops page reload) |
| `onChange` | typing / select |
| `onClick` | buttons, 3-dot, eye icon |
| `onBlur` | inline edit saves when you leave the box |
| `onKeyDown` | Enter save, Escape cancel |

### 3.6 React Router

Without a router you would have one giant page. Router maps **URL → component**.

| Tool | Meaning here |
|------|----------------|
| `BrowserRouter` | Enable URLs |
| `Routes` / `Route` | URL rules in `App.tsx` |
| `Link` / `NavLink` | Change page without full refresh (`NavLink` = active style) |
| `Navigate` | No token → `/login` |
| `Outlet` | Hole in Layout for the child page |
| `useNavigate` | Logout, shortcuts |
| `useLocation` | Page title in the navbar |
| `useSearchParams` | `/products?add=1` opens Add modal |

**Nested routes:** Layout is parent. Dashboard / Products / Sales / Settings are children. Sidebar stays; only the middle changes.

### 3.7 Axios

HTTP from the browser:

- `post` — create (signup, login, add)
- `get` — read
- `put` — update
- `delete` — remove

```tsx
axios.get(`${API_URL}/api/products`, { headers: authHeader() })
```

`response.data` is JSON from Node.  
No `error.response` → backend is off.

`setupApi()` in `auth.ts` is an **interceptor**: if status **401** and message is “Please login first” / “Invalid or expired token”, clear storage and go to login. Wrong password is also 401 but a different message, so it does **not** kick you out of the login form.

### 3.8 Context (Toast)

`ToastProvider` wraps the app in `main.tsx`. Any page can call `useToast()` → `showToast("Product added", "success")`. Message slides in from the right for 2.5 seconds. This avoids copying alert UI on every page.

### 3.9 localStorage vs React state

| | React state | localStorage |
|--|-------------|--------------|
| Lives | RAM, gone on refresh | Browser disk |
| Used for | forms, tables, modals | `token` + `user` |

After login we save token then `window.location.href = "/dashboard"` (full reload). Layout reads the token.

### 3.10 TypeScript

```tsx
interface Product {
  id: number;
  name: string;
  price: number | string; // MySQL DECIMAL often arrives as string
  stock: number;
}
```

`.tsx` = TypeScript + JSX. Catches wrong props before runtime.

### 3.11 Tailwind

Utility classes: `flex`, `bg-teal-700`, `rounded-xl`, `text-red-600`.  
Brand colors: **teal** (primary), **amber** (stock), **sky** (sales), **red** (logout / delete / close).  
`index.css` has `@import "tailwindcss"` plus toast animation. Font is **Outfit**.

---

## 4. Folder tree

```
login-signup-page/
├── README.md
├── .vscode/                      editor CSS lint
│
├── frontend/                     port 5173
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── pages/                one file = one screen
│   │   ├── components/           reusable UI (tables, forms, modals)
│   │   ├── hooks/                shared page behavior (`?add=1`)
│   │   ├── App.tsx               URL map
│   │   ├── main.tsx              app start + setupApi + ToastProvider
│   │   ├── api.ts                Axios calls; add/update return the row
│   │   ├── types.ts              Product, Sale, money, upsertById
│   │   ├── auth.ts               token helpers
│   │   ├── roles.ts              owner / manager / cashier flags
│   │   └── index.css             Tailwind + toast animation
│   ├── index.html                only real HTML page
│   ├── vite.config.ts            React + Tailwind + /api proxy
│   ├── .env.example              VITE_API_URL (blank = proxy)
│   └── package.json
│
└── backend/                      port 5000
    ├── server.js                 HTTP server, CORS, dispatch
    ├── db.js                     MySQL connection
    ├── middleware/auth.js        JWT requireLogin
    ├── routes/                   URL → service
    ├── services/                 rules + SQL
    ├── utils/                    JSON, validation, rate limit, transactions
    ├── tests/api.test.js         cost, profit, stock, cashier tenant
    ├── sql/simple-schema.sql     products + sales + stock_movements
    ├── sql/migrate-business.sql  ALTER live DB (no DROP of products/sales)
    ├── migrate-business.js       run ALTERs; ignores duplicate columns
    ├── setup-db.js
    ├── .env                      secrets (not in Git)
    └── package.json
```

**Rule:** `pages` = screens. `components` = Lego. `routes` = doors. `services` = brain + SQL.

---

## 5. Frontend files (every important one)

### `index.html`

Browser loads this. Empty `<div id="root">`. React injects the whole SPA. Loads Outfit font. Tab title: Inventory.

### `main.tsx`

1. Import CSS  
2. `setupApi()` — 401 logout  
3. Render `<ToastProvider><App /></ToastProvider>` inside `StrictMode`

### `App.tsx`

Router only. Does not fetch products.

- `/` → `/stores` (marketplace)  
- `/login` → store staff login (username)  
- `/account/login`, `/register` → customer  
- `/super/login` → platform admin  
- `/shop/:slug` → public shop + checkout  
- `/dashboard`, `/products`, `/stock`, `/orders`, `/settings` → store panel inside `Layout`

### `auth.ts`

| Function | Job |
|----------|-----|
| `API_URL` | `import.meta.env.VITE_API_URL ?? ""` |
| `getToken` / `getUser` | read localStorage |
| `clearAuth` | logout |
| `saveUser` | after name change + custom event `auth-user-changed` |
| `authHeader` | `{ Authorization: "Bearer " + token }` |
| `getApiError` | Axios error → string |
| `getUserInitials` | “Ali Khan” → “AK” |
| `setupApi` | interceptor for expired JWT |

### `api.ts`

All product/sale/dashboard Axios calls. Create/update helpers return `{ message, product }` or `{ message, sale, product }` so pages can merge into state instead of refetching or reloading.

### `vite.config.ts`

```ts
proxy: { "/api": "http://localhost:5000" }
```

Browser calls `/api/login` on 5173; Vite forwards to Node.

### Pages

**`Login.tsx`**  
Store staff: **username** + password. `POST /api/login` → dashboard.  
Customer and super admin use their own login pages (`CustomerLogin.tsx`, `SuperLogin.tsx`).  
Public store signup is disabled; super admin creates stores. Customers register at `/register`.

**`Dashboard.tsx`**  
Loads `/api/dashboard?period=month|all`, products, sales.  
Cards: Products, Stock, **Revenue**, **Gross Profit** (red if negative). Cashiers do not see revenue/profit. Low-stock names under the cards. Graphs: revenue by day in the period, stock per product.

**`Products.tsx`**  
Search + row count (`TableToolbar`). Cost + sale price (hover-edit). **Stock is read-only** — change it on the Stock page. Opening qty on Add Product writes an `opening` movement. Hidden from cashiers.

**`Stock.tsx`**  
Movement history (product, type, qty, note, date). **Stock In** and **Damage** modals (`ProductSelect` + `Field`). Hidden from cashiers.

**`Sales.tsx`**  
Same `PagePanel` + `DataTable` + `AddButton`. Add sale (shared `ProductSelect` + quantity). Hover product/qty/amount/date for owner/manager. Cashiers can add and list only. Amount snapshot is calculated on the server.

**`Settings.tsx`**  
Avatar + email + role. Update name/password. Owner also lists/creates/removes Manager and Cashier staff.

### Components

| File | Concept |
|------|---------|
| `Layout.tsx` | Shell: token check, Sidebar, navbar title, avatar, name, 3-dot UserMenu, `<Outlet />` |
| `Sidebar.tsx` | Nav links + logo box + **Logout** `mt-auto` red |
| `AuthCard.tsx` | Login/Signup shell (logo + title + footer) |
| `PagePanel.tsx` | White card + title or search/row count + right-side actions |
| `TableToolbar.tsx` | SearchBar + live row count (Products, Sales, Stock) |
| `StatCard.tsx` | Dashboard metric card |
| `PeriodToggle.tsx` | This month / All time |
| `Select.tsx` | Shared dropdown used by ProductSelect and staff role |
| `SaveButton.tsx` | Teal submit on Settings |
| `SearchBar.tsx` | Small search box |
| `Field.tsx` | Shared labeled input |
| `SubmitButton.tsx` | Auth submit with loading label |
| `ModalActions.tsx` | Red Cancel + teal Save inside modals |
| `ProductSelect.tsx` | Product dropdown with sale price + live stock |
| `LowStockBadge.tsx` | Red **Low** when stock &lt; 3 |
| `DataTable.tsx` | Sortable columns (asc/desc) + pagination |
| `BrandLogo.tsx` | Same teal IconBox used on Login/Signup |
| `Avatar.tsx` | Initials circle |
| `Modal.tsx` | Overlay + box; red **X** |
| `ConfirmModal.tsx` | `Delete Mouse?` |
| `PasswordInput.tsx` | `type=password` or `text`; eye / eye-off |
| `InlineEdit.tsx` | Hover pencil; input or `<select>` if `options` |
| `RowMenu.tsx` | ⋮ Edit + Delete |
| `UserMenu.tsx` | Navbar ⋮ → Profile (Settings) / Add Product / Add Sale (`?add=1`) |
| `BarChart.tsx` | SVG bars, Y ticks, X labels, values on bars |
| `Pagination.tsx` | Chevron control `< 1 >`; only current page (used by DataTable) |
| `Toast.tsx` | Context + slide-in messages |
| `icons.tsx` | Inline SVGs (no icon library) |

---

## 6. Backend concepts (Node HTTP)

This backend does **not** use Express in running code. `http.createServer` gives `req` and `res`.

### Request / response

- `req.method` — GET, POST, PUT, DELETE, OPTIONS  
- `req.url` — path (`/api/products/3`)  
- `req.headers.authorization` — `Bearer <jwt>`  
- `res.writeHead(status, headers)` + `res.end(JSON)`

**OPTIONS** = CORS preflight (browser asks “may I PUT with Authorization?”).

### Why routes + services?

| Layer | Job | Example |
|-------|-----|---------|
| `server.js` | CORS, dispatch, catch errors | if not found → 404 |
| `routes/` | URL, `requireLogin`, read body, send JSON | `POST /api/sales` |
| `services/` | Validate, SQL, stock math | `addSale` |
| `utils/` | Shared helpers | `query`, rate limit |
| `middleware/auth.js` | JWT | `jwt.verify` |

Route files **return `true`** if they handled the request so `server.js` stops.

### `ServiceError`

```js
throw new ServiceError(400, "Not enough stock");
```

`server.js` catches it and sends `{ message }` with that status. Routes stay thin.

### Native HTTP helpers (`utils/http.js`)

- `getPath` — strip `?query`  
- `getNumericId("/api/products/3", "/api/products")` → `3`  
- `getRequestBody` — listen to `data`/`end`, `JSON.parse`, max ~1 MB  
- `sendJSON` — CORS + `Content-Type: application/json`  
- `toNumber` — safe `Number()` (invalid → 0)

### Promises + SQL (`utils/query.js`)

`mysql2` callbacks are wrapped:

```js
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
  });
}
```

**Prepared statements:** `"WHERE user_id = ?"` + `[userId]` — user input is **not** glued into the SQL string. That blocks **SQL injection**.

### Transactions (`withTransaction`)

Sale + stock must succeed together:

```
BEGIN
  lock product FOR UPDATE
  insert sale
  update stock
COMMIT
```

If stock is too low or SQL fails → **ROLLBACK**. No “sale saved but stock not updated”.

### Auth service

- Signup: trim name, lowercase email, regex email, password 8+ with letter and number, `bcrypt.hash(password, 10)`, insert, `jwt.sign({ id, email }, JWT_SECRET, { expiresIn: "1h" })`
- Login: find user, `bcrypt.compare`, same JWT
- Response **never** includes the hash

### Rate limit (`utils/rateLimit.js`)

In-memory map `ip:email` → fail count. **5** fails inside **15 minutes** → HTTP **429**. Success resets the counter. Restarting Node clears the map (OK for mini project).

### `requireLogin`

```js
const token = header.split(" ")[1];
return jwt.verify(token, process.env.JWT_SECRET);
```

Missing token → 401 “Please login first”. Bad/expired → 401 “Invalid or expired token”.

Layout hiding pages is **UX**. This function is **real security**.

### `tenantId`

Every product/sale/movement row stores the **shop owner** in `user_id`. JWT `tenantId` is that owner id (for staff, `owner_id`). Queries: `WHERE user_id = ?` with `auth.tenantId`, never the cashier’s raw id. Ali cannot edit Ahmed’s Mouse.

### Stock rules (say this in viva)

| Action | Stock + movement |
|--------|--------|
| Add product with opening qty | stock set, type `opening` |
| Stock in | stock +, type `in` |
| Damage | stock −, type `damage` |
| Add sale qty 3 | stock − 3, type `sale` |
| Delete that sale | stock + 3, type `sale_return` |
| Edit qty 3 → 5 | stock − 2, extra `sale` |

`total_amount` and `cost_amount` are snapshotted from current sale/cost prices × qty. Hover-edit of amount changes revenue only.

Dashboard **Revenue** = `SUM(total_amount)`. **Gross profit** = revenue − `SUM(cost_amount)`.

### HTTP status codes used

| Code | Meaning here |
|------|----------------|
| 200 | OK |
| 201 | Created (signup, add) |
| 204 | OPTIONS success, no body |
| 400 | Validation / cannot delete product in use |
| 401 | Bad login or bad/expired token |
| 403 | Wrong role (cashier hitting stock/products/staff) |
| 409 | Email already exists |
| 429 | Too many logins |
| 500 | Unexpected server error |

### Libraries (what we actually use)

| Package | Why |
|---------|-----|
| `mysql2` | SQL |
| `bcryptjs` | hash passwords |
| `jsonwebtoken` | JWT |
| `dotenv` | `.env` → `process.env` |
| `nodemon` (dev) | optional auto-restart |

**Not used in running code:** Express (removed so viva is not confused). CORS headers are written by hand in `utils/http.js`.

### Tests (`npm test` in `backend/`)

Node built-in test runner. Creates a throwaway owner, logs in, rejects a wrong password, adds a product at cost **6** / sale **10** with stock 8, sells **2**, asserts stock **6**, revenue **20**, COGS **12**, profit **8**, then stock-in **+4**, then a cashier under the same tenant. Cleans up movements/sales/products/staff/user.

---

## 7. Database

**Name:** `login_signup_db` (from `.env` `DB_NAME`)

### `users`

| Column | Idea |
|--------|------|
| id | primary key |
| name | display name |
| email | unique login |
| password | **bcrypt hash**, never the real password |
| role | `owner` (signup) / `manager` / `cashier` |
| owner_id | NULL for owners; staff → parent owner id |

`setup-db.js` does **not** drop `users`. Existing accounts get `role='owner'` from `migrate-business.sql`.

### `products`

`id`, `user_id` (tenant / owner id), `name`, `price` (sale price), `cost_price`, `stock`, `created_at`

### `sales`

`id`, `user_id`, `product_id`, `quantity`, `unit_price`, `unit_cost`, `total_amount`, `cost_amount`, `created_at`

### `stock_movements`

`id`, `user_id`, `product_id`, `type` (`opening` \| `in` \| `sale` \| `sale_return` \| `damage` \| `adjust`), `quantity` (always positive), `note`, `created_by`, `created_at`

You cannot delete a product that still has sales (FK). Delete sales first, or the API returns “used in sales”.

**JOIN:** sales table has no product name. API:

```sql
SELECT sales.*, products.name AS product
FROM sales
INNER JOIN products ON products.id = sales.product_id
WHERE sales.user_id = ?
```

Run schema (destroys products/sales/movements):

```powershell
cd F:\login-signup-page\backend
node setup-db.js
```

Upgrade an existing shop DB **without dropping data**:

```powershell
node migrate-business.js
```

---

## 8. Authentication end-to-end

1. User submits login/signup  
2. Backend validates → hash or compare → JWT 1 hour  
3. React stores `token` + `user` (id, name, email, role, tenantId)  
4. Later: `Authorization: Bearer <token>`  
5. `jwt.verify` → `tenantId` for SQL  
6. After 1 hour: 401 → interceptor → login page  

**Two locks + isolation**

| Lock | Job |
|------|-----|
| Layout | hide UI if no token; cashiers cannot open Products/Stock/Settings |
| `requireLogin` / `requireRole` | reject API without JWT or with the wrong role |
| `tenantId` | row-level shop isolation |

---

## 9. API list

| Method | URL | Idea |
|--------|-----|------|
| GET | `/` | Health: backend running |
| POST | `/api/signup` | User + token |
| POST | `/api/login` | Password + token + rate limit |
| GET | `/api/dashboard` | Products, stock, revenue, COGS, profit, low stock (`?period=month\|all`) |
| GET | `/api/products` | List shop catalog (cashiers allowed) |
| POST | `/api/products` | Add (owner/manager) |
| PUT | `/api/products/:id` | Edit name/cost/sale price |
| DELETE | `/api/products/:id` | Remove if unused in sales |
| GET | `/api/sales` | List + product name |
| POST | `/api/sales` | Add + snapshot prices + reduce stock |
| PUT | `/api/sales/:id` | Qty/product/amount/date (not cashier) |
| DELETE | `/api/sales/:id` | Remove + restore stock (not cashier) |
| GET | `/api/stock` | Movement history (owner/manager) |
| POST | `/api/stock` | Stock in / damage / adjust |
| GET | `/api/staff` | List shop staff (owner) |
| POST | `/api/staff` | Create manager/cashier (owner) |
| DELETE | `/api/staff/:id` | Remove staff (owner) |
| PUT | `/api/profile` | Name |
| PUT | `/api/profile/password` | Current password + new hash |

GET = read, POST = create, PUT = update, DELETE = remove.

Create/update APIs return the saved row so React can `setState` immediately:

- Product POST/PUT → `{ message, product }`
- Sale POST/PUT → `{ message, sale, product }` (`previous_product` if the product changed)
- Sale DELETE → `{ message, product }` with stock restored

The page does **not** call `window.location` after add/update. Login/signup use React Router `navigate`.

---

## 10. Environment variables

**`backend/.env`** (never in React, never commit):

- `PORT` (default 5000)
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` — server **exits** if missing

**`frontend/.env`** (optional):

- `VITE_API_URL` — leave empty to use Vite proxy

Only names starting with `VITE_` are visible in the browser bundle.

---

## 11. How to run

Terminal 1:

```powershell
cd F:\login-signup-page\backend
node server.js
```

Terminal 2:

```powershell
cd F:\login-signup-page\frontend
npm run dev
```

Open `http://localhost:5173/` (Login).

Tests:

```powershell
cd F:\login-signup-page\backend
npm test
```

---

## 12. One-minute viva speech

> I built a full-stack inventory back-office. React Router + Tailwind show Login, Dashboard, Products, Stock, Sales, Settings. Axios talks to a Node HTTP API through a Vite proxy. Routes call services; services use MySQL with parameterized queries. Each shop is a tenant: JWT carries `tenantId` (the owner’s id) so cashiers see the owner’s catalog. Products have cost and sale price; sales snapshot both so later price edits do not rewrite profit. Stock changes go through movements, not a typed stock field. Roles are Owner, Manager, and Cashier. Passwords are bcrypt hashes. Login returns a JWT for one hour. Adding a sale reduces stock inside a transaction. The dashboard shows revenue and gross profit for this month or all time.

---

## 13. Short Q&A

**Why React?** Split UI into components; update the screen when state changes.

**Why not SQL in React?** The browser is not trusted. Anyone can edit frontend code.

**What is a hook?** A function starting with `use` (`useState`, `useEffect`, `useNavigate`).

**Virtual DOM (simple)?** React describes UI and updates only what changed.

**Why TypeScript?** Catch wrong types before the app runs.

**GET vs POST vs PUT vs DELETE?** Read, create, update, remove.

**What is CORS?** Browser rule: page on 5173 cannot call 5000 unless the server allows that origin. We also use a **proxy** so `/api` looks same-origin.

**Why bcrypt?** Stolen DB should not show real passwords. `compare` checks login.

**Why JWT?** Later requests prove login without storing sessions in Node memory. Payload `{ id, email, role, tenantId }`, signed with `JWT_SECRET`.

**Why `tenantId`?** Staff work inside the owner’s shop. Queries use the owner’s id, not the cashier’s id.

**Why a transaction?** Sale insert, stock update, and the movement row must all happen or none.

**Why `?` in SQL?** Placeholders stop SQL injection.

**Layout vs requireLogin?** Layout is a fake door (UX). JWT on the API is the real lock.

**Why not Express?** Project rule: understand `req`/`res` without a framework.

**What is pagination?** Show 5 rows per page so the table stays short.

**What is an interceptor?** Axios middleware that runs on every response (here: auto-logout on expired token).

---

## 14. Mental model (memorize)

1. **`pages/`** = screens  
2. **`components/`** = reusable UI  
3. **`App.tsx`** = which URL  
4. **`auth.ts`** = token in localStorage  
5. **`server.js` → routes → services** = APIs + rules + SQL  
6. **`db.js`** = MySQL door  
7. **React state** = what you see now  
8. **MySQL + `tenantId`** = what is saved, per shop  

If you can explain those eight lines with one example (add sale → stock down), you can explain the whole project.

---

## 15. Hardening

What this codebase does beyond the happy path:

- **httpOnly cookies.** Login/signup/refresh set `access_token` (15m) and `refresh_token` (7d) with `HttpOnly; Path=/; SameSite=Lax`. The browser still sends them; JavaScript cannot read them. Bearer tokens still work for tests. Copy `backend/.env.example` — never commit `JWT_SECRET`.
- **Server lists.** `GET /api/products|sales|customers|suppliers|expenses|stock` take `q`, `page`, `limit`, or `all=1` and return `{ rows, total }`. Tables do not download the whole shop to paginate.
- **Indexes.** `user_id` / `created_at` indexes plus unique `(user_id, name)` and unique SKU per shop. Run `node migrate-indexes.js` on an existing DB.
- **Stock races.** Sale and stock updates lock the product row (`SELECT … FOR UPDATE`). Two cashiers cannot sell the last unit twice.
- **Legacy sales.product_id.** Invoice lines live in `sale_items`. The old `sales.product_id` column stays nullable leftover and is no longer written.
- **Tests.** `backend`: `npm test` (login, profit, concurrent last unit, customer unlink, HTTP cookies, cashier 403). `frontend`: `npm test` (session storage, Escape closes modal).
- **UI.** Error toasts are slate; success stays teal. Modals close on Escape.

```powershell
cd F:\login-signup-page\backend
node migrate-indexes.js
npm test

cd F:\login-signup-page\frontend
npm test
```
