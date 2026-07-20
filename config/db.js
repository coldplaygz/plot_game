const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '192.168.9.2',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'plot_game',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  charsetNumber: 224,       // utf8mb4 数字编码
  collation: 'utf8mb4_unicode_ci',
  connectTimeout: 10000
});

// 每次获取连接时确保 charset 正确
pool.on('connection', (conn) => {
  conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
});

pool.getConnection()
  .then(conn => {
    console.log('[DB] 数据库连接成功');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] 数据库连接失败:', err.message);
  });

module.exports = pool;
