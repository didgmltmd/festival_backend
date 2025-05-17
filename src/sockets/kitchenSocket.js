// WebSocket 연결 저장
const zoneSockets = { A: null, B: null, C: null };

function setupKitchenSocket(io) {
  io.on("connection", (socket) => {
    console.log("클라이언트 접속됨");

    socket.on("joinZone", (zone) => {
      if (["A", "B", "C"].includes(zone)) {
        zoneSockets[zone] = socket;
        console.log(`${zone} 구역 연결됨`);
      }
    });

    socket.on("orderDeleted", (timestamp) => {
      console.log("주문 삭제 요청 수신됨:", timestamp);
      
      // A, B, C 모두에게 삭제 알림 전송
      for (const zone of ["A", "B", "C"]) {
        if (zoneSockets[zone]) {
          zoneSockets[zone].emit("orderDeleted", timestamp);
          console.log(`${zone} 구역에 삭제 전송됨: ${timestamp}`);
        }
      }
    });

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

// 주문 저장 후 실시간 전송 함수
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
      console.log(`${zone} 구역에 전송됨`, zoneOrders[zone]);
    }
  }
}

module.exports = {
  setupKitchenSocket,
  emitOrderToZones,
};
