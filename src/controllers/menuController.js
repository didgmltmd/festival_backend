const { getMenuItems, run, zones } = require("../db");

const validMenu = (name, price, zone) =>
  name?.trim() && Number.isFinite(Number(price)) && Number(price) >= 0 && zones.includes(zone);

const findByIndex = (index) => getMenuItems(true)[Number(index)];

exports.getMenuItems = (req, res) => {
  res.json(getMenuItems(req.query.includeInactive === "true"));
};

exports.addMenuItem = (req, res) => {
  const { name, price, zone } = req.body;

  if (!validMenu(name, price, zone)) {
    return res.status(400).json({ error: "메뉴명, 가격, 구역(A/B/C/COUNTER)이 필요합니다." });
  }

  try {
    run(
      `
        INSERT INTO menu_items (name, price, zone, active)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(name) DO UPDATE SET price = excluded.price, zone = excluded.zone, active = 1
      `,
      [name.trim(), Number(price), zone]
    );
    res.status(201).json({ success: true, message: "메뉴가 저장되었습니다." });
  } catch (err) {
    res.status(500).json({ error: "메뉴 저장에 실패했습니다." });
  }
};

exports.updateMenuItem = (req, res) => {
  const target = findByIndex(req.params.index);
  if (!target) return res.status(404).json({ error: "메뉴를 찾을 수 없습니다." });

  const nextName = req.body.name?.trim() || target.name;
  const nextPrice = req.body.price === undefined ? target.price : Number(req.body.price);
  const nextZone = req.body.zone || target.zone;
  const nextActive = req.body.active === undefined ? target.active : Boolean(req.body.active);

  if (!validMenu(nextName, nextPrice, nextZone)) {
    return res.status(400).json({ error: "올바른 메뉴명, 가격, 구역이 필요합니다." });
  }

  run("UPDATE menu_items SET name = ?, price = ?, zone = ?, active = ? WHERE id = ?", [
    nextName,
    nextPrice,
    nextZone,
    nextActive ? 1 : 0,
    target.id,
  ]);
  res.json({ success: true, message: "메뉴가 수정되었습니다." });
};

exports.deleteMenuItem = (req, res) => {
  const target = findByIndex(req.params.index);
  if (!target) return res.status(404).json({ error: "메뉴를 찾을 수 없습니다." });

  run("UPDATE menu_items SET active = 0 WHERE id = ?", [target.id]);
  res.json({ success: true, message: "메뉴가 비활성화되었습니다." });
};
