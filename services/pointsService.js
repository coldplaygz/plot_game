/**
 * 积分服务 - 统一处理积分扣除/增加 + 交易日志
 * 所有积分变动使用数据库事务 + 原子更新，保证并发安全：
 *  - deductPoints     普通扣费（每次调用都扣，如道具/回退）
 *  - deductPointsOnce 幂等扣费（同一 user+type+ref_id 只扣一次，如付费选项）
 *  - addPoints        加积分（充值/赠送/退款）
 */
const pool = require('../config/db');

/**
 * 检查余额并扣除积分（原子操作，并发安全）
 * 条件更新 points >= ? 同时完成余额检查与扣除，行锁保持到事务提交，
 * 并发请求在数据库层串行化，杜绝"读改写丢更新"与负余额
 * @param {number} userId - 用户ID
 * @param {number} amount - 扣除金额（正数）
 * @param {string} type - 交易类型 'choice'|'prop'|'backtrack'|...
 * @param {number|null} refId - 关联ID（choice_id / prop_id）
 * @param {string} remark - 备注
 * @returns {Promise<{success: boolean, balance?: number, message?: string, current?: number, required?: number}>}
 */
async function deductPoints(userId, amount, type, refId, remark) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 原子扣费：余额不足时 affectedRows = 0
    const [upd] = await conn.query(
      'UPDATE users SET points = points - ? WHERE id = ? AND points >= ?',
      [amount, userId, amount]
    );

    if (upd.affectedRows === 0) {
      // 区分：用户不存在 vs 余额不足
      const [rows] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
      await conn.rollback();
      if (rows.length === 0) return { success: false, message: '用户不存在' };
      return {
        success: false,
        message: `需要 ${amount} 积分，当前余额 ${rows[0].points} 积分`,
        current: rows[0].points,
        required: amount
      };
    }

    // 事务内读取扣后余额（可见本事务的更新）
    const [[user]] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
    const newBalance = user.points;

    await conn.query(
      `INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [userId, -amount, type, refId, newBalance, remark]
    );

    await conn.commit();
    return { success: true, balance: newBalance };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 幂等扣费：同一 (user_id, type, ref_id) 组合只扣一次
 * 通过 SELECT ... FOR UPDATE 锁用户行，同一用户的并发请求在事务层串行化：
 * 第二个请求等锁提交后能读到第一个请求写入的流水 → 返回 alreadyPaid
 * 适用于"付费选项永久买断"等天然幂等的扣费场景
 * @returns {Promise<{success: boolean, alreadyPaid?: boolean, balance?: number, message?: string, current?: number, required?: number}>}
 */
async function deductPointsOnce(userId, amount, type, refId, remark) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 锁用户行：串行化同一用户的并发请求
    const [rows] = await conn.query('SELECT points FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (rows.length === 0) {
      await conn.rollback();
      return { success: false, message: '用户不存在' };
    }

    // 幂等检查：已存在同类型同关联ID的扣费流水则跳过
    const [paid] = await conn.query(
      'SELECT id FROM points_log WHERE user_id = ? AND type = ? AND ref_id = ? LIMIT 1',
      [userId, type, refId]
    );
    if (paid.length > 0) {
      await conn.rollback();
      return { success: true, alreadyPaid: true, balance: rows[0].points };
    }

    if (rows[0].points < amount) {
      await conn.rollback();
      return {
        success: false,
        message: `需要 ${amount} 积分，当前余额 ${rows[0].points} 积分`,
        current: rows[0].points,
        required: amount
      };
    }

    const newBalance = rows[0].points - amount;
    await conn.query('UPDATE users SET points = ? WHERE id = ?', [newBalance, userId]);
    await conn.query(
      `INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [userId, -amount, type, refId, newBalance, remark]
    );

    await conn.commit();
    return { success: true, alreadyPaid: false, balance: newBalance };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * 增加积分（充值/赠送/管理员调整/退款）
 * 相对更新 points + ? 保证并发安全，余额与流水在同一事务写入
 * @param {number} userId - 用户ID
 * @param {number} amount - 增加金额（正数）
 * @param {number|null} operatorId - 操作者ID
 * @param {string} type - 交易类型 'recharge'|'admin'|'refund'
 * @param {number|null} refId - 关联ID
 * @param {string} remark - 备注
 * @returns {Promise<{balance: number}>}
 */
async function addPoints(userId, amount, operatorId, type, refId, remark) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 原子累加（用户不存在时 affectedRows = 0）
    const [upd] = await conn.query(
      'UPDATE users SET points = points + ? WHERE id = ?',
      [amount, userId]
    );
    if (upd.affectedRows === 0) {
      await conn.rollback();
      throw new Error('用户不存在');
    }

    const [[user]] = await conn.query('SELECT points FROM users WHERE id = ?', [userId]);
    await conn.query(
      `INSERT INTO points_log (user_id, operator_id, points, type, ref_id, balance, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, operatorId || null, amount, type, refId, user.points, remark]
    );

    await conn.commit();
    return { balance: user.points };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { deductPoints, deductPointsOnce, addPoints };
