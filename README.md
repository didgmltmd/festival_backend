# 🎪 Festival Order Management – Backend

실시간 축제 주문 시스템의 **백엔드** 레포입니다.  
주문 생성 → 조리 상태 변경 → 서빙 완료를 **WebSocket(Socket.IO)** 으로 실시간 브로드캐스트하며,
카운터/조리/서빙 대시보드와 연동됩니다.

- Frontend: https://github.com/didgmltmd/festival_front
- Backend-swagger: https://festival-backend-wwht.onrender.com/api-docs/

---

## Features

- REST API + Socket.IO 실시간 이벤트
- A/B/C **구역(zone)** 기반 운영
- **주문/항목/상태** (대기 → 조리중 → 완료 → 서빙완료) 관리
- 검색/필터(구역, 상태, 시간)
- 역할 분리(카운터/조리/서빙) UI를 위한 **상태 구독 채널**

---

## Tech Stack

- Runtime: Node.js (>= 18)
- Framework: Express
- Realtime: Socket.IO
- Deploy: Render 

---
