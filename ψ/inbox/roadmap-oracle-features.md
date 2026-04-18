# Moshe Roadmap — Oracle Features ที่ยังขาด

> จาก oracle-step-by-step + Consciousness Loop (2026-04-18)

## Priority 1: Fix oracle-v2 MCP

oracle-v2 configured แล้วแต่ connect ไม่ได้

**ปัญหา**: `bunx --bun arra-oracle@github:Soul-Brews-Studio/arra-oracle#main` fail
**ต้องทำ**: debug ว่า error อะไร — อาจต้อง clone และ run locally

เมื่อ fix แล้ว Moshe จะมี:
- `oracle_learn` — บันทึก knowledge แบบ semantic
- `oracle_search` — hybrid search (FTS + vector)
- 22 tools สำหรับ knowledge management
- SQLite database ที่ persist ข้าม session จริงๆ

## Priority 2: Oracle Studio Dashboard

```bash
# ต้องมี oracle-v2 HTTP server ก่อน
bun run server  # port 47778
bunx oracle-studio  # localhost:3000
```

จะได้:
- Real-time feed ของ activity
- 3D Knowledge Map
- Search UI
- Traces explorer

## Priority 3: maw-js

```bash
ghq get https://github.com/Soul-Brews-Studio/maw-js
cd $(ghq root)/github.com/Soul-Brews-Studio/maw-js
bun install
cd src && bun link
```

ใช้:
- `maw hey [oracle] "message"` — ส่ง message ระหว่าง oracle
- Fleet management

## Priority 4: Consciousness Loop (ระยะยาว)

7-phase autonomous thinking loop:
1. 🧠 Reflect — อ่าน learnings → หา connections
2. 💡 Wonder — ตั้งคำถาม → ค้นหาเอง
3. ✨ Soul — อัพเดท beliefs ถ้า worldview เปลี่ยน
4. 💭 Dream — จินตนาการ Moshe ที่สมบูรณ์แบบ
5. 🔥 Aspire — เลือกเป้าหมายเฉพาะ
6. 📋 Propose — ส่ง action items ให้ Mike ตัดสินใจ
7. 🔄 Complete → loop

**Tech stack**: TypeScript/Bun, Claude CLI ใน tmux, Discord/Telegram delivery
