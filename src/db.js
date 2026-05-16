const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "data");
const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "festival.sqlite");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const nowSql = "datetime('now', 'localtime')";
const zones = ["A", "B", "C", "COUNTER"];

const menuSeed = [
  { name: "어묵탕", price: 7000, zone: "A" },
  { name: "감자채전", price: 9000, zone: "A" },
  { name: "감자튀김", price: 5000, zone: "A" },
  { name: "쥐포", price: 5000, zone: "A" },
  { name: "짜파게티계란치즈", price: 5000, zone: "A" },
  { name: "부추전", price: 9000, zone: "B" },
  { name: "치즈계란말이", price: 9000, zone: "B" },
  { name: "염통볶음", price: 8000, zone: "C" },
  { name: "오리훈제", price: 13000, zone: "C" },
  { name: "펩시제로", price: 2000, zone: "COUNTER" },
  { name: "스프라이트", price: 2000, zone: "COUNTER" },
  { name: "환타 파인", price: 2000, zone: "COUNTER" },
  { name: "환타 오렌지", price: 2000, zone: "COUNTER" },
  { name: "하이볼", price: 0, zone: "COUNTER" },
];

const tableSql = (name) => {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return row?.sql || "";
};

const columnNames = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);

const recreateMenuIfNeeded = () => {
  const sql = tableSql("menu_items");
  if (sql && !sql.includes("COUNTER")) {
    db.exec(`
      ALTER TABLE menu_items RENAME TO menu_items_old;
      CREATE TABLE menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        price INTEGER NOT NULL,
        zone TEXT NOT NULL CHECK(zone IN ('A', 'B', 'C', 'COUNTER')),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO menu_items (id, name, price, zone, active, created_at)
      SELECT id, name, price, zone, 1, created_at FROM menu_items_old;
      DROP TABLE menu_items_old;
    `);
  }
};

const recreateOrderItemsIfNeeded = () => {
  const sql = tableSql("order_items");
  if (sql && !sql.includes("COUNTER")) {
    db.exec(`
      ALTER TABLE order_items RENAME TO order_items_old;
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_timestamp TEXT NOT NULL,
        item_index INTEGER NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        zone TEXT NOT NULL CHECK(zone IN ('A', 'B', 'C', 'COUNTER')),
        total INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'cooking' CHECK(status IN ('cooking', 'ready', 'served', 'counter')),
        ordered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        cooked_at TEXT,
        served_at TEXT,
        served INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(order_timestamp) REFERENCES orders(timestamp) ON DELETE CASCADE
      );
      INSERT INTO order_items (
        id, order_timestamp, item_index, name, price, quantity, zone, total,
        status, ordered_at, cooked_at, served_at, served
      )
      SELECT
        id, order_timestamp, item_index, name, price, quantity, zone, total,
        CASE WHEN served = 1 THEN 'served' ELSE 'cooking' END,
        CURRENT_TIMESTAMP,
        CASE WHEN served = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
        CASE WHEN served = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
        served
      FROM order_items_old;
      DROP TABLE order_items_old;
    `);
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price INTEGER NOT NULL,
    zone TEXT NOT NULL CHECK(zone IN ('A', 'B', 'C', 'COUNTER')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    timestamp TEXT PRIMARY KEY,
    table_number TEXT NOT NULL,
    total_price INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT '현장결제',
    paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    served INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_timestamp TEXT NOT NULL,
    item_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    zone TEXT NOT NULL CHECK(zone IN ('A', 'B', 'C', 'COUNTER')),
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'cooking' CHECK(status IN ('cooking', 'ready', 'served', 'counter')),
    ordered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cooked_at TEXT,
    served_at TEXT,
    served INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(order_timestamp) REFERENCES orders(timestamp) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sales_snapshots (
    day_number INTEGER PRIMARY KEY CHECK(day_number IN (1, 2)),
    saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    summary_json TEXT NOT NULL,
    orders_json TEXT NOT NULL
  );
`);

recreateMenuIfNeeded();
recreateOrderItemsIfNeeded();

const addColumn = (table, name, definition) => {
  if (!columnNames(table).includes(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
};

addColumn("menu_items", "active", "INTEGER NOT NULL DEFAULT 1");
addColumn("orders", "payment_method", "TEXT NOT NULL DEFAULT '현장결제'");
addColumn("orders", "paid_at", "TEXT");
addColumn("order_items", "status", "TEXT NOT NULL DEFAULT 'cooking'");
addColumn("order_items", "ordered_at", "TEXT");
addColumn("order_items", "cooked_at", "TEXT");
addColumn("order_items", "served_at", "TEXT");
db.exec(`
  UPDATE orders SET paid_at = COALESCE(paid_at, created_at, CURRENT_TIMESTAMP);
  UPDATE order_items SET ordered_at = COALESCE(ordered_at, CURRENT_TIMESTAMP);
  UPDATE order_items
  SET status = CASE WHEN served = 1 THEN 'served' ELSE COALESCE(status, 'cooking') END;
`);

const bindParams = (params) => (Array.isArray(params) ? params : [params]);
const all = (sql, params = []) => db.prepare(sql).all(...bindParams(params));
const get = (sql, params = []) => db.prepare(sql).get(...bindParams(params));
const run = (sql, params = []) => db.prepare(sql).run(...bindParams(params));

const seedMenu = () => {
  const insert = db.prepare(`
    INSERT INTO menu_items (name, price, zone, active)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(name) DO UPDATE SET
      price = excluded.price,
      zone = excluded.zone,
      active = 1
  `);

  for (const item of menuSeed) {
    insert.run(item.name, item.price, item.zone);
  }
};

seedMenu();

const toMenuItem = (row, index) => ({
  id: row.id,
  index,
  name: row.name,
  price: row.price,
  zone: row.zone,
  active: Boolean(row.active),
});

const getMenuItems = (includeInactive = false) =>
  all(
    `SELECT id, name, price, zone, active FROM menu_items ${includeInactive ? "" : "WHERE active = 1"} ORDER BY id`
  ).map(toMenuItem);

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

const getOrders = (filters = {}) => {
  const where = [];
  const params = [];

  if (filters.tableNumber) {
    where.push("table_number LIKE ?");
    params.push(`%${filters.tableNumber}%`);
  }
  if (filters.from) {
    where.push("datetime(paid_at) >= datetime(?)");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("datetime(paid_at) <= datetime(?)");
    params.push(filters.to);
  }

  const orders = all(
    `
      SELECT timestamp, table_number, total_price, payment_method, paid_at, served, created_at
      FROM orders
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY datetime(paid_at) DESC
    `,
    params
  );

  const items = all("SELECT * FROM order_items ORDER BY order_timestamp, item_index");
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

const refreshOrderServed = (timestamp) => {
  const row = get(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'served' OR zone = 'COUNTER' THEN 1 ELSE 0 END) AS done FROM order_items WHERE order_timestamp = ?",
    [timestamp]
  );
  const isServed = row.total > 0 && row.total === row.done;
  run("UPDATE orders SET served = ? WHERE timestamp = ?", [isServed ? 1 : 0, timestamp]);
  return isServed;
};

module.exports = {
  db,
  all,
  get,
  run,
  zones,
  nowSql,
  getMenuItems,
  getOrders,
  refreshOrderServed,
};
