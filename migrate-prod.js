const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'plot_game',
    charset: 'utf8mb4'
  });

  const cols = [
    ['gender', "ENUM('male','female','other') DEFAULT NULL"],
    ['age', 'TINYINT UNSIGNED DEFAULT NULL'],
    ['preferences', 'VARCHAR(500) DEFAULT NULL'],
  ];

  for (const [col, def] of cols) {
    try {
      const [c] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME=?", [process.env.DB_NAME, col]);
      if (c.length === 0) {
        await pool.query(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
        console.log(col + ' 已添加');
      } else {
        console.log(col + ' 已存在');
      }
    } catch (e) {
      console.log(col + ' 失败:', e.message);
    }
  }

  console.log('迁移完成');
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
