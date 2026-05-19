const fs = require("fs");
const path = require("path");
const { initDb, run, pool } = require("../src/db");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const main = async () => {
  const backupDir = path.join(__dirname, "..", "backups");
  const summaryPath = path.join(backupDir, "sales_summary_day1_vyck_render.json");
  const snapshotsPath = path.join(backupDir, "sales_snapshots_vyck_render.json");

  const summary = readJson(summaryPath);
  const snapshots = fs.existsSync(snapshotsPath) ? readJson(snapshotsPath) : [];
  const day1 = snapshots.find((snapshot) => Number(snapshot.dayNumber) === 1);

  await initDb();
  await run(
    `
      INSERT INTO sales_snapshots (day_number, saved_at, summary_json, orders_json, order_count)
      VALUES ($1, $2, $3::jsonb, '[]'::jsonb, $4)
      ON CONFLICT(day_number) DO UPDATE SET
        saved_at = EXCLUDED.saved_at,
        summary_json = EXCLUDED.summary_json,
        orders_json = EXCLUDED.orders_json,
        order_count = EXCLUDED.order_count
    `,
    [
      1,
      day1?.savedAt || new Date().toISOString(),
      JSON.stringify(summary),
      Number(day1?.orderCount || 0),
    ]
  );

  console.log(
    `Imported day 1 summary: ${summary.length} items, ${day1?.totalRevenue || 0} revenue, ${day1?.orderCount || 0} orders`
  );
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
