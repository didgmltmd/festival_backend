const { all, get, run, getOrders } = require("../db");

const getCurrentSummary = () =>
  all(`
    SELECT
      name,
      SUM(quantity) AS totalSold,
      SUM(total) AS totalRevenue
    FROM order_items
    GROUP BY name
    ORDER BY totalRevenue DESC, name ASC
  `);

const parseSnapshot = (row) => ({
  dayNumber: row.day_number,
  savedAt: row.saved_at,
  summary: JSON.parse(row.summary_json),
  orders: JSON.parse(row.orders_json),
});

exports.getSalesSummary = (req, res) => {
  const dayNumber = Number(req.query.day);

  if (dayNumber === 1 || dayNumber === 2) {
    const snapshot = get("SELECT * FROM sales_snapshots WHERE day_number = ?", [
      dayNumber,
    ]);
    res.json(snapshot ? parseSnapshot(snapshot).summary : []);
    return;
  }

  res.json(getCurrentSummary());
};

exports.getSalesSnapshots = (req, res) => {
  const snapshots = all(
    "SELECT day_number, saved_at, summary_json, orders_json FROM sales_snapshots ORDER BY day_number"
  ).map(parseSnapshot);

  res.json(
    snapshots.map((snapshot) => ({
      dayNumber: snapshot.dayNumber,
      savedAt: snapshot.savedAt,
      totalRevenue: snapshot.summary.reduce(
        (sum, item) => sum + Number(item.totalRevenue || 0),
        0
      ),
      totalSold: snapshot.summary.reduce(
        (sum, item) => sum + Number(item.totalSold || 0),
        0
      ),
      orderCount: snapshot.orders.length,
    }))
  );
};

exports.resetSalesData = (req, res) => {
  const dayNumber = Number(req.body?.dayNumber);

  if (req.body?.dayNumber !== undefined && dayNumber !== 1 && dayNumber !== 2) {
    res.status(400).json({ error: "dayNumber must be 1 or 2." });
    return;
  }

  const summary = getCurrentSummary();
  const orders = getOrders();

  if (dayNumber === 1 || dayNumber === 2) {
    run(
      `
        INSERT INTO sales_snapshots (day_number, saved_at, summary_json, orders_json)
        VALUES (?, datetime('now', 'localtime'), ?, ?)
        ON CONFLICT(day_number) DO UPDATE SET
          saved_at = excluded.saved_at,
          summary_json = excluded.summary_json,
          orders_json = excluded.orders_json
      `,
      [dayNumber, JSON.stringify(summary), JSON.stringify(orders)]
    );
  }

  run("DELETE FROM order_items");
  run("DELETE FROM orders");

  req.io?.emit("salesReset", { dayNumber: dayNumber || null });
  res.json({ ok: true, savedDayNumber: dayNumber || null });
};
