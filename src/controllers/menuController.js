const { getMenuItems, run, zones } = require("../db");

const validMenu = (name, price, zone) =>
  name?.trim() && Number.isFinite(Number(price)) && Number(price) >= 0 && zones.includes(zone);

const findByIndex = async (index) => (await getMenuItems(true))[Number(index)];

exports.getMenuItems = async (req, res) => {
  res.json(await getMenuItems(req.query.includeInactive === "true"));
};

exports.addMenuItem = async (req, res) => {
  const { name, price, zone } = req.body;

  if (!validMenu(name, price, zone)) {
    return res.status(400).json({ error: "메뉴명, 가격, 구역(A/B/C/COUNTER)이 필요합니다." });
  }

  try {
    await run(
      `
        INSERT INTO menu_items (name, price, zone, active)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT(name) DO UPDATE SET price = EXCLUDED.price, zone = EXCLUDED.zone, active = TRUE
      `,
      [name.trim(), Number(price), zone]
    );
    res.status(201).json({ success: true, message: "메뉴가 저장되었습니다." });
  } catch (err) {
    console.error("Menu save error:", err);
    res.status(500).json({ error: "메뉴 저장에 실패했습니다." });
  }
};

exports.updateMenuItem = async (req, res) => {
  const target = await findByIndex(req.params.index);
  if (!target) return res.status(404).json({ error: "메뉴를 찾을 수 없습니다." });

  const nextName = req.body.name?.trim() || target.name;
  const nextPrice = req.body.price === undefined ? target.price : Number(req.body.price);
  const nextZone = req.body.zone || target.zone;
  const nextActive = req.body.active === undefined ? target.active : Boolean(req.body.active);

  if (!validMenu(nextName, nextPrice, nextZone)) {
    return res.status(400).json({ error: "올바른 메뉴명, 가격, 구역이 필요합니다." });
  }

  await run("UPDATE menu_items SET name = $1, price = $2, zone = $3, active = $4 WHERE id = $5", [
    nextName,
    nextPrice,
    nextZone,
    nextActive,
    target.id,
  ]);
  res.json({ success: true, message: "메뉴가 수정되었습니다." });
};

exports.deleteMenuItem = async (req, res) => {
  const target = await findByIndex(req.params.index);
  if (!target) return res.status(404).json({ error: "메뉴를 찾을 수 없습니다." });

  await run("UPDATE menu_items SET active = FALSE WHERE id = $1", [target.id]);
  res.json({ success: true, message: "메뉴가 비활성화되었습니다." });
};
