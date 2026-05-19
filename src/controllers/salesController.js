const { all, get, run, getOrders } = require("../db");

const getCurrentSummary = async () =>
  all(`
    SELECT
      name,
      SUM(quantity)::int AS "totalSold",
      SUM(total)::int AS "totalRevenue"
    FROM order_items
    GROUP BY name
    ORDER BY SUM(total) DESC, name ASC
  `);

const parseSnapshot = (row) => ({
  dayNumber: row.day_number,
  savedAt: row.saved_at,
  summary: typeof row.summary_json === "string" ? JSON.parse(row.summary_json) : row.summary_json,
  orders: typeof row.orders_json === "string" ? JSON.parse(row.orders_json) : row.orders_json,
  orderCount: Number(row.order_count || 0),
});

exports.getSalesSummary = async (req, res) => {
  const dayNumber = Number(req.query.day);

  if (dayNumber === 1 || dayNumber === 2) {
    const snapshot = await get("SELECT * FROM sales_snapshots WHERE day_number = $1", [dayNumber]);
    res.json(snapshot ? parseSnapshot(snapshot).summary : []);
    return;
  }

  res.json(await getCurrentSummary());
};

exports.getSalesSnapshots = async (req, res) => {
  const snapshots = (
    await all("SELECT day_number, saved_at, summary_json, orders_json, order_count FROM sales_snapshots ORDER BY day_number")
  ).map(parseSnapshot);

  res.json(
    snapshots.map((snapshot) => ({
      dayNumber: snapshot.dayNumber,
      savedAt: snapshot.savedAt,
      totalRevenue: snapshot.summary.reduce((sum, item) => sum + Number(item.totalRevenue || 0), 0),
      totalSold: snapshot.summary.reduce((sum, item) => sum + Number(item.totalSold || 0), 0),
      orderCount: snapshot.orderCount || snapshot.orders.length,
    }))
  );
};

exports.resetSalesData = async (req, res) => {
  const dayNumber = Number(req.body?.dayNumber);

  if (req.body?.dayNumber !== undefined && dayNumber !== 1 && dayNumber !== 2) {
    res.status(400).json({ error: "dayNumber must be 1 or 2." });
    return;
  }

  const summary = await getCurrentSummary();
  const orders = await getOrders();

  if (dayNumber === 1 || dayNumber === 2) {
    await run(
      `
        INSERT INTO sales_snapshots (day_number, saved_at, summary_json, orders_json, order_count)
        VALUES ($1, TO_CHAR(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'), $2::jsonb, $3::jsonb, $4)
        ON CONFLICT(day_number) DO UPDATE SET
          saved_at = EXCLUDED.saved_at,
          summary_json = EXCLUDED.summary_json,
          orders_json = EXCLUDED.orders_json,
          order_count = EXCLUDED.order_count
      `,
      [dayNumber, JSON.stringify(summary), JSON.stringify(orders), orders.length]
    );
  }

  await run("DELETE FROM order_items");
  await run("DELETE FROM orders");

  req.io?.emit("salesReset", { dayNumber: dayNumber || null });
  res.json({ ok: true, savedDayNumber: dayNumber || null });
};
