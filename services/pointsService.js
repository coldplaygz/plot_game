/**
 * 积分服务 - 统一处理积分扣除/增加 + 交易日志
 * 消除 routes/play.js、routes/props.js、routes/recharge.js 中的重复逻辑
 */
const pool = require('../config/db');

/**
 * 检查余额并扣除积分
 * @param {number} userId - 用户ID
 * @param {number} amount - 扣除金额（正数）
 * @param {string} type - 交易类型 'choice'|'prop'|'other'
 * @param {number|null} refId - 关联ID（choice_id / prop_id）
 * @param {string} remark - 备注
 * @returns {Promise<{success: boolean, balance?: number, message?: string}>}
 */
async function deductPoints(userId, amount, type, refId, remark) {
  const [rows] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) return { success: false, message: '用户不存在' };

  const current = rows[0].points;
  if (current < amount) {
    return {
      success: false,
      message: `需要 ${amount} 积分，当前余额 ${current} 积分`,
      current,
      required: amount
    };
  }

  const newBalance = current - amount;
  await pool.query('UPDATE users SET points = ? WHERE id = ?', [newBalance, userId]);
  await pool.query(
    `INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark)
     VALUES (?, NULL, ?, ?, ?, ?, ?)`,
    [userId, -amount, type, refId, newBalance, remark]
  );

  return { success: true, balance: newBalance };
}

/**
 * 增加积分（充值/赠送/管理员调整）
 * @param {number} userId - 用户ID
 * @param {number} amount - 增加金额（正数）
 * @param {number|null} operatorId - 操作者ID
 * @param {string} type - 交易类型 'recharge'|'admin'|'refund'
 * @param {number|null} refId - 关联ID
 * @param {string} remark - 备注
 * @returns {Promise<{balance: number}>}
 */
async function addPoints(userId, amount, operatorId, type, refId, remark) {
  const [rows] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
  const current = rows.length > 0 ? rows[0].points : 0;
  const newBalance = current + amount;

  await pool.query('UPDATE users SET points = ? WHERE id = ?', [newBalance, userId]);
  await pool.query(
    `INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, operatorId || null, amount, type, refId, newBalance, remark]
  );

  return { balance: newBalance };
}

module.exports = { deductPoints, addPoints };
