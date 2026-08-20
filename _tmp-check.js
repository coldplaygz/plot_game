require('dotenv').config();
const pool = require('./config/db');
(async () => {
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='plot_game' AND TABLE_NAME='points_log'"
  );
  console.log(JSON.stringify(cols, null, 1));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1) });
