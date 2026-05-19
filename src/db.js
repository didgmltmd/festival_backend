const { Pool } = require("pg");

const zones = ["A", "B", "C", "COUNTER"];

const menuSeed = [
  { name: "어묵탕", price: 7000, zone: "A", active: true },
  { name: "감자채전", price: 9000, zone: "A", active: true },
  { name: "감자튀김", price: 5000, zone: "B", active: false },
  { name: "쥐포&감자튀김", price: 5000, zone: "A", active: true },
  { name: "짜파게티계란치즈", price: 5000, zone: "A", active: true },
  { name: "부추전", price: 9000, zone: "B", active: true },
  { name: "치즈계란말이", price: 8000, zone: "B", active: true },
  { name: "염통볶음", price: 8000, zone: "C", active: true },
  { name: "오리훈제", price: 13000, zone: "C", active: false },
  { name: "펩시제로", price: 2000, zone: "COUNTER", active: true },
  { name: "스프라이트", price: 2000, zone: "COUNTER", active: true },
  { name: "환타 파인", price: 2000, zone: "COUNTER", active: true },
  { name: "환타 오렌지", price: 2000, zone: "COUNTER", active: true },
  { name: "하이볼", price: 0, zone: "COUNTER", active: true },
  { name: "뻥스크림(회비서비스)", price: 0, zone: "A", active: true },
  { name: "뻥스크림", price: 4500, zone: "A", active: true },
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for PostgreSQL storage.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

const all = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

const get = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows[0];
};

const run = async (sql, params = []) => pool.query(sql, params);

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL,
      zone TEXT NOT NULL CHECK(zone IN ('A', 'B', 'C', 'COUNTER')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      timestamp TEXT PRIMARY KEY,
      table_number TEXT NOT NULL,
      total_price INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT '현장결제',
      paid_at TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'),
      served BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_timestamp TEXT NOT NULL REFERENCES orders(timestamp) ON DELETE CASCADE,
      item_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      zone TEXT NOT NULL CHECK(zone IN ('A', 'B', 'C', 'COUNTER')),
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'cooking' CHECK(status IN ('cooking', 'ready', 'served', 'counter')),
      ordered_at TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'),
      cooked_at TEXT,
      served_at TEXT,
      served BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS sales_snapshots (
      day_number INTEGER PRIMARY KEY CHECK(day_number IN (1, 2)),
      saved_at TEXT NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'),
      summary_json JSONB NOT NULL,
      orders_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      order_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    ALTER TABLE sales_snapshots
      ADD COLUMN IF NOT EXISTS order_count INTEGER NOT NULL DEFAULT 0;
  `);

  for (const item of menuSeed) {
    await run(
      `
        INSERT INTO menu_items (name, price, zone, active)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(name) DO UPDATE SET
          price = EXCLUDED.price,
          zone = EXCLUDED.zone,
          active = EXCLUDED.active
      `,
      [item.name, item.price, item.zone, item.active]
    );
  }
};

const toMenuItem = (row, index) => ({
  id: row.id,
  index,
  name: row.name,
  price: row.price,
  zone: row.zone,
  active: Boolean(row.active),
});

const getMenuItems = async (includeInactive = false) => {
  const rows = await all(
    `SELECT id, name, price, zone, active FROM menu_items ${includeInactive ? "" : "WHERE active = TRUE"} ORDER BY id`
  );
  return rows.map(toMenuItem);
};

const toOrderItem = (item) => ({
  itemIndex: item.item_index,
  name: item.name,
  price: item.price,
  quantity: item.quantity,
  zone: item.zone,
  total: item.total,
  status: item.status,
  orderedAt: item.ordered_at,
  cookedAt: item.cooked_at,
  servedAt: item.served_at,
  served: Boolean(item.served),
  missing: item.zone !== "COUNTER" && item.status !== "served",
});

const getOrders = async (filters = {}) => {
  const where = [];
  const params = [];

  if (filters.tableNumber) {
    params.push(`%${filters.tableNumber}%`);
    where.push(`table_number ILIKE $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    where.push(`paid_at::timestamptz >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`paid_at::timestamptz <= $${params.length}::timestamptz`);
  }

  const orders = await all(
    `
      SELECT timestamp, table_number, total_price, payment_method, paid_at, served, created_at
      FROM orders
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY paid_at::timestamptz DESC
    `,
    params
  );

  const items = await all("SELECT * FROM order_items ORDER BY order_timestamp, item_index");
  const grouped = new Map();

  for (const item of items) {
    if (!grouped.has(item.order_timestamp)) grouped.set(item.order_timestamp, []);
    grouped.get(item.order_timestamp).push(toOrderItem(item));
  }

  return orders.map((order, index) => {
    const orderItems = grouped.get(order.timestamp) || [];
    return {
      orderNumber: orders.length - index,
      tableNumber: order.table_number,
      items: orderItems,
      totalPrice: order.total_price,
      paymentMethod: order.payment_method,
      paidAt: order.paid_at,
      timestamp: order.timestamp,
      served: Boolean(order.served),
      missingCount: orderItems.filter((item) => item.missing).length,
    };
  });
};

const refreshOrderServed = async (timestamp) => {
  const row = await get(
    "SELECT COUNT(*)::int AS total, COALESCE(SUM(CASE WHEN status = 'served' OR zone = 'COUNTER' THEN 1 ELSE 0 END), 0)::int AS done FROM order_items WHERE order_timestamp = $1",
    [timestamp]
  );
  const isServed = row.total > 0 && row.total === row.done;
  await run("UPDATE orders SET served = $1 WHERE timestamp = $2", [isServed, timestamp]);
  return isServed;
};

module.exports = {
  pool,
  all,
  get,
  run,
  transaction,
  zones,
  initDb,
  getMenuItems,
  getOrders,
  refreshOrderServed,
};
