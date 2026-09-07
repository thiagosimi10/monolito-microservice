-- =============================================================================
--  database/seed.sql  --  DEV-ONLY seed data for the Monolito Lab
-- =============================================================================
--
--  ##  WARNING: LOCAL DEVELOPMENT ONLY  ##
--
--  This script is DESTRUCTIVE. It runs:
--
--      TRUNCATE TABLE sales, users RESTART IDENTITY CASCADE;
--
--  which DELETES every row in `sales` and `users` and resets the id
--  sequences back to 1. Never run it against a production database.
--
--  After running, the database contains EXACTLY:
--      * 100 users   -> "Usuario 001" .. "Usuario 100"  (ids 1..100)
--      * 1000 sales  -> spread across those 100 users
--
--  It is NOT executed automatically. `docker compose up` only starts the
--  system; you run this seed explicitly (see below).
--
--  The data is reproducible: random() is seeded with setseed() so repeated
--  runs on the same PostgreSQL engine produce the same rows.
--
--  How to run:
--      make seed
--    or
--      docker compose exec -T postgres psql -U postgres -d monolith < database/seed.sql
--
--  Schema reference (backend/alembic/versions/0001_initial.py):
--      users(id PK, name varchar(255), created_at timestamptz)
--      sales(id PK, user_id int FK -> users.id, item_name varchar(255),
--            quantity int, created_at timestamptz)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Reset: wipe both tables and restart id sequences at 1.
--    CASCADE is required because sales.user_id references users.id.
-- ---------------------------------------------------------------------------
TRUNCATE TABLE sales, users RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Make random() deterministic for this session.
-- ---------------------------------------------------------------------------
SELECT setseed(0.42);

-- ---------------------------------------------------------------------------
-- 3. Insert exactly 100 users: "Usuario 001" .. "Usuario 100".
--    Ids become 1..100 thanks to RESTART IDENTITY above.
--    created_at is spread across roughly the last year.
-- ---------------------------------------------------------------------------
INSERT INTO users (name, created_at)
SELECT
    'Usuario ' || to_char(gs, 'FM000') AS name,
    NOW() - make_interval(
        days => (floor(random() * 365))::int,
        secs => (floor(random() * 86400))::int
    ) AS created_at
FROM generate_series(1, 100) AS gs;

-- ---------------------------------------------------------------------------
-- 4. Insert exactly 1000 sales.
--    user_id   : random existing user, 1..100 (FK always valid)
--    item_name : one of 10 fictional products
--    quantity  : 1..10  (never 0, never negative)
--    created_at: spread across the last ~180 days
-- ---------------------------------------------------------------------------
INSERT INTO sales (user_id, item_name, quantity, created_at)
SELECT
    1 + floor(random() * 100)::int AS user_id,
    (ARRAY[
        'Perfume Malbec',
        'Perfume Lily',
        'Perfume Egeo',
        'Creme Corporal',
        'Shampoo',
        'Condicionador',
        'Desodorante',
        'Sabonete',
        'Protetor Solar',
        'Kit Presente'
    ])[1 + floor(random() * 10)::int] AS item_name,
    1 + floor(random() * 10)::int AS quantity,
    NOW() - make_interval(
        days => (floor(random() * 181))::int,
        secs => (floor(random() * 86400))::int
    ) AS created_at
FROM generate_series(1, 1000) AS gs;

COMMIT;

-- ---------------------------------------------------------------------------
-- 5. Validation (printed to the console when run through psql).
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== users count (expected: 100) ==='
SELECT COUNT(*) AS users_count FROM users;

\echo ''
\echo '=== sales count (expected: 1000) ==='
SELECT COUNT(*) AS sales_count FROM sales;

\echo ''
\echo '=== distinct users referenced by sales (expected: many, not 1) ==='
SELECT COUNT(DISTINCT user_id) AS distinct_users_in_sales FROM sales;

\echo ''
\echo '=== orphan sales / invalid FK (expected: 0) ==='
SELECT COUNT(*) AS orphan_sales
FROM sales s
LEFT JOIN users u ON u.id = s.user_id
WHERE u.id IS NULL;

\echo ''
\echo '=== top 10 users by number of sales (JOIN users x sales) ==='
SELECT
    u.id,
    u.name,
    COUNT(s.id)                 AS total_sales,
    COALESCE(SUM(s.quantity),0) AS total_items
FROM users u
LEFT JOIN sales s ON s.user_id = u.id
GROUP BY u.id, u.name
ORDER BY total_sales DESC
LIMIT 10;
