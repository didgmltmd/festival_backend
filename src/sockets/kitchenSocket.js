// WebSocket 연결 저장
const zoneSockets = { A: null, B: null, C: null };

function setupKitchenSocket(io) {
  io.on("connection", (socket) => {
    console.log("📡 클라이언트 접속됨:", socket.id);

    // 구역 등록
    socket.on("joinZone", (zone) => {
      if (["A", "B", "C"].includes(zone)) {
        zoneSockets[zone] = socket;
        console.log(`${zone} 구역 연결됨`);
      }
    });

    // 주문 삭제 이벤트 수신 → 전체 클라이언트에게 broadcast
    socket.on("orderDeleted", ({ timestamp, itemIndex }) => {
      console.log("주문 삭제 요청 수신:", { timestamp, itemIndex });

      // 모든 클라이언트에게 전달 (자기 자신 포함)
      io.emit("orderDeleted", { timestamp, itemIndex });

      console.log("📡 전체 구역에 삭제 전파 완료");
    });

    // 소켓 연결 종료 시 처리
    socket.on("disconnect", () => {
      for (let zone in zoneSockets) {
        if (zoneSockets[zone] === socket) {
          zoneSockets[zone] = null;
          console.log(`❌ ${zone} 구역 연결 종료`);
        }
      }
    });
  });
}

// 주문 저장 후 각 구역으로 분할 전송
function emitOrderToZones(order) {
  const zoneOrders = { A: [], B: [], C: [] };

  for (const item of order.items) {
    const { zone, name, quantity } = item;
    if (zoneOrders[zone]) {
      zoneOrders[zone].push({
        name,
        quantity,
        tableNumber: order.tableNumber,
      });
    }
  }

  for (const zone of ["A", "B", "C"]) {
    if (zoneSockets[zone] && zoneOrders[zone].length > 0) {
      zoneSockets[zone].emit("newOrder", zoneOrders[zone]);
      console.log(`${zone} 구역에 주문 전송됨`, zoneOrders[zone]);
    }
  }
}

module.exports = {
  setupKitchenSocket,
  emitOrderToZones,
};

console.log();