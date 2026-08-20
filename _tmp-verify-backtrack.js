// 返回上一场景：成功扣款路径验证（先给测试账号补积分）
require('dotenv').config();
const pool = require('./config/db');
const BASE = 'http://localhost:3000/api';

async function main() {
  const lr = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  }).then(r => r.json());
  const H = { 'Authorization': 'Bearer ' + lr.token, 'Content-Type': 'application/json' };

  const [chain] = await pool.query(`
    SELECT c.scene_id AS from_id FROM choices c JOIN scenes s ON c.scene_id = s.id
    WHERE s.game_id = 5 AND c.next_scene_id IS NOT NULL LIMIT 1`);
  const fromId = chain[0].from_id;

  // 补 100 积分（记录原始值用于还原）
  const [u0] = await pool.query('SELECT points FROM users WHERE id = 1');
  await pool.query('UPDATE users SET points = ? WHERE id = 1', [u0[0].points + 100]);

  // 确保成本 10
  await fetch(BASE + '/config', {
    method: 'PUT', headers: H,
    body: JSON.stringify({ configs: [{ config_key: 'backtrack_cost', config_value: '10' }] })
  }).then(r => r.json());

  // 成功回退
  const bt = await fetch(BASE + '/play/backtrack', {
    method: 'POST', headers: H, body: JSON.stringify({ to_scene_id: fromId })
  }).then(r => r.json());
  console.log('回退响应:', JSON.stringify({
    scene_id: bt.scene?.id, scene_title: bt.scene?.title?.slice(0, 10),
    choices: bt.scene?.choices?.length, point_cost: bt.point_cost, points_balance: bt.points_balance
  }));

  const [u1] = await pool.query('SELECT points FROM users WHERE id = 1');
  console.log('积分:', u0[0].points, '+100 →', u1[0].points, '(应扣 10)');

  const [pl] = await pool.query("SELECT points, type, ref_id, balance, remark FROM points_log WHERE user_id=1 AND type='other' ORDER BY id DESC LIMIT 1");
  console.log('流水:', JSON.stringify(pl[0]));

  // 还原
  await pool.query('UPDATE users SET points = ? WHERE id = 1', [u0[0].points]);
  console.log('积分已还原为', u0[0].points);
  process.exit(0);
}
main().catch(e => { console.error('失败:', e.message); process.exit(1) });
