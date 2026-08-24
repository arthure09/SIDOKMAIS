// Read-only query runner. Usage: node q.js "SQL"
// Guard: refuses anything that isn't SELECT/SHOW/DESCRIBE.
require('dotenv').config();
const mysql = require('mysql2/promise');

const sql = process.argv[2];
if (!/^\s*(select|show|describe|desc)\b/i.test(sql || '')) {
  console.error('BLOCKED: read-only statements only');
  process.exit(1);
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.SIMRS_HOST,
    port: Number(process.env.SIMRS_PORT),
    user: process.env.SIMRS_USER,
    password: process.env.SIMRS_PASSWORD,
  });
  const [rows] = await conn.query(sql);
  console.log(JSON.stringify(rows, null, 1));
  await conn.end();
})().catch((e) => {
  console.error('ERR:', e.code, e.message);
  process.exit(1);
});
