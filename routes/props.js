const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { deductPoints } = require('../services/pointsService');

const router = express.Router();

// 获取可用道具（游戏端，只返回已发布）
// Query: ?scene_id=N  按场景过滤：返回该场景绑定的幻想道具 + scene_id 为 NULL 的通用道具 + 效果道具
router.get('/available', authenticate, async (req, res) => {
  try {
    const sceneId = req.query.scene_id ? parseInt(req.query.scene_id) : null;
    let sql = `
      SELECT p.*, v.filename AS video_filename, v.hls_status, v.hls_master_path,
             v.duration AS video_duration
      FROM props p
      LEFT JOIN videos v ON p.video_id = v.id
      WHERE p.is_published = 1
    `;
    const params = [];
    if (sceneId) {
      // 幻想场景道具：只返回绑定到该场景的（scene_id = ?）
      // 效果道具：scene_id 为 NULL（通用），始终可用
      // 即：fantasy 类型必须严格匹配 scene_id；effect 类型只在 scene_id 为 NULL 时返回
      sql += ` AND (
        (p.type = 'fantasy' AND p.scene_id = ?)
        OR (p.type = 'effect' AND p.scene_id IS NULL)
      )`;
      params.push(sceneId);
    } else {
      // 未传 scene_id：只返回通用道具（scene_id 为 NULL），不返回任何绑定到具体场景的幻想道具
      sql += ` AND p.scene_id IS NULL`;
    }
    sql += ` ORDER BY p.sort_order ASC, p.id ASC`;
    const [rows] = await pool.query(sql, params);
    res.json({ props: rows });
  } catch (err) {
    console.error('[Props] 获取可用道具失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取所有道具（管理后台）
router.get('/all', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, v.filename AS video_filename, v.duration AS video_duration,
             s.title AS scene_title, s.chapter AS scene_chapter
      FROM props p
      LEFT JOIN videos v ON p.video_id = v.id
      LEFT JOIN scenes s ON p.scene_id = s.id
      ORDER BY p.type ASC, p.sort_order ASC, p.id ASC
    `);
    res.json({ props: rows });
  } catch (err) {
    console.error('[Props] 获取道具失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建道具
router.post('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { name, name_i18n, type, icon, animation, video_id, scene_id, point_cost, sort_order, is_published } = req.body;
    if (!name) return res.status(400).json({ error: '道具名称不能为空' });
    const propType = type === 'fantasy' ? 'fantasy' : 'effect';
    if (propType === 'fantasy' && !video_id) {
      return res.status(400).json({ error: '幻想场景道具必须关联视频' });
    }
    if (propType === 'fantasy' && !scene_id) {
      return res.status(400).json({ error: '幻想场景道具必须绑定到具体场景' });
    }
    const [result] = await pool.query(
      `INSERT INTO props (name, name_i18n, type, icon, animation, video_id, scene_id, point_cost, sort_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        name_i18n ? JSON.stringify(name_i18n) : null,
        propType,
        icon || '🎁',
        animation || null,
        video_id ? parseInt(video_id) : null,
        // effect 类型不绑定场景（通用）；fantasy 类型绑定到指定场景
        propType === 'fantasy' && scene_id ? parseInt(scene_id) : null,
        parseInt(point_cost) || 0,
        parseInt(sort_order) || 0,
        is_published === undefined ? 1 : (is_published ? 1 : 0)
      ]
    );
    res.status(201).json({ message: '道具创建成功', prop: { id: result.insertId, name } });
  } catch (err) {
    console.error('[Props] 创建道具失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新道具
router.put('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { name, name_i18n, type, icon, animation, video_id, scene_id, point_cost, sort_order, is_published } = req.body;
    const [rows] = await pool.query('SELECT id FROM props WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '道具不存在' });

    const newType = type === 'fantasy' ? 'fantasy' : 'effect';

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (name_i18n !== undefined) { fields.push('name_i18n = ?'); values.push(name_i18n ? JSON.stringify(name_i18n) : null); }
    if (type !== undefined) { fields.push('type = ?'); values.push(newType); }
    if (icon !== undefined) { fields.push('icon = ?'); values.push(icon || '🎁'); }
    if (animation !== undefined) { fields.push('animation = ?'); values.push(animation || null); }
    if (video_id !== undefined) { fields.push('video_id = ?'); values.push(video_id ? parseInt(video_id) : null); }
    if (scene_id !== undefined) {
      // effect 类型强制 scene_id = NULL（通用）；fantasy 类型绑定到指定场景
      if (newType === 'fantasy') {
        fields.push('scene_id = ?'); values.push(scene_id ? parseInt(scene_id) : null);
      } else {
        fields.push('scene_id = ?'); values.push(null);
      }
    }
    if (point_cost !== undefined) { fields.push('point_cost = ?'); values.push(parseInt(point_cost) || 0); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order) || 0); }
    if (is_published !== undefined) { fields.push('is_published = ?'); values.push(is_published ? 1 : 0); }
    if (fields.length === 0) return res.status(400).json({ error: '没有需要更新的字段' });

    values.push(req.params.id);
    await pool.query(`UPDATE props SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '道具已更新' });
  } catch (err) {
    console.error('[Props] 更新道具失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除道具
router.delete('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id FROM props WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '道具不存在' });
    await pool.query('DELETE FROM props WHERE id = ?', [req.params.id]);
    res.json({ message: '道具已删除' });
  } catch (err) {
    console.error('[Props] 删除道具失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 使用道具排行榜（日/周/月/年）
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const period = ['day', 'week', 'month', 'year'].includes(req.query.period) ? req.query.period : 'week';
    const since = new Date();
    if (period === 'day') since.setDate(since.getDate() - 1);
    else if (period === 'week') since.setDate(since.getDate() - 7);
    else if (period === 'month') since.setMonth(since.getMonth() - 1);
    else if (period === 'year') since.setFullYear(since.getFullYear() - 1);

    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.nickname,
             COUNT(pu.id) AS use_count,
             COALESCE(SUM(p.point_cost), 0) AS points_spent
      FROM prop_usages pu
      JOIN users u ON pu.user_id = u.id
      LEFT JOIN props p ON pu.prop_id = p.id
      WHERE pu.created_at >= ?
      GROUP BY u.id, u.username, u.nickname
      ORDER BY use_count DESC, points_spent DESC
      LIMIT 50
    `, [since]);

    // 当前用户排名
    let myRank = null;
    const myIndex = rows.findIndex(r => r.id === req.user.id);
    if (myIndex >= 0) myRank = { rank: myIndex + 1, ...rows[myIndex] };

    res.json({ leaderboard: rows, period, myRank });
  } catch (err) {
    console.error('[Props] 排行榜获取失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 使用道具（扣积分）
router.post('/:id/use', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM props WHERE id = ? AND is_published = 1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '道具不存在' });
    const prop = rows[0];
    const userId = req.user.id;
    const sceneId = req.body.scene_id ? parseInt(req.body.scene_id) : null;

    // 幻想场景道具：校验该道具是否绑定到当前场景（绑定关系存在才允许使用）
    if (prop.type === 'fantasy' && prop.scene_id) {
      if (!sceneId || sceneId !== prop.scene_id) {
        return res.status(403).json({
          error: '该幻想场景道具未绑定到当前场景，无法使用',
          prop_scene_id: prop.scene_id,
          current_scene_id: sceneId
        });
      }
    }

    // 扣积分（使用统一 service）
    if (prop.point_cost > 0) {
      const result = await deductPoints(userId, prop.point_cost, 'prop', prop.id, `使用道具: ${prop.name}`);
      if (!result.success) {
        return res.status(402).json({
          error: '积分不足',
          required: result.required,
          current: result.current,
          message: `使用「${prop.name}」需要 ${prop.point_cost} 积分，当前余额 ${result.current} 积分`
        });
      }
    }

    // 记录使用
    await pool.query(
      'INSERT INTO prop_usages (user_id, prop_id, scene_id) VALUES (?, ?, ?)',
      [userId, prop.id, sceneId]
    );

    // 响应：幻想场景道具返回关联视频信息
    let video = null;
    if (prop.type === 'fantasy' && prop.video_id) {
      const [vRows] = await pool.query(
        'SELECT id, filename, file_path, duration, hls_status, hls_master_path FROM videos WHERE id = ?',
        [prop.video_id]
      );
      if (vRows.length > 0) video = vRows[0];
    }

    // 查询用户当前积分余额（deductPoints 已更新积分，这里读取最新值）
    const [[userRow]] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
    const balance = userRow ? userRow.points : 0;

    const response = {
      message: '道具使用成功',
      prop: { id: prop.id, name: prop.name, type: prop.type, animation: prop.animation },
      points_consumed: prop.point_cost > 0,
      points_balance: balance,
      video
    };
    res.json(response);
  } catch (err) {
    console.error('[Props] 使用道具失败:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
