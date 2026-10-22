const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// 获取所有存档位（slot 1-9），可选按 game_id 过滤
router.get('/', async (req, res) => {
  try {
    const gameId = req.query.game_id ? parseInt(req.query.game_id) : null;
    let whereClause = 'WHERE s.user_id = ? AND s.slot > 0';
    const params = [req.user.id];
    if (gameId) {
      whereClause += ' AND s.game_id = ?';
      params.push(gameId);
    }

    const [rows] = await pool.query(`
      SELECT s.*, sc.title AS scene_title, sc.chapter,
             v.file_path AS scene_video, g.title AS game_title
      FROM saves s
      LEFT JOIN scenes sc ON s.scene_id = sc.id
      LEFT JOIN videos v ON sc.video_id = v.id
      LEFT JOIN games g ON s.game_id = g.id
      ${whereClause}
      ORDER BY s.slot ASC
    `, params);
    res.json({ saves: rows });
  } catch (err) {
    console.error('[Saves] 获取存档列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取自动存档（slot 规则：-game_id 为该游戏的自动档，0 为无游戏归属的兜底档）
// ?game_id=X → 返回该游戏的自动档；不带 game_id → 返回最近更新的一份自动档
router.get('/auto', async (req, res) => {
  try {
    const gameId = req.query.game_id ? parseInt(req.query.game_id) : null;
    const baseSql = `
      SELECT s.*, sc.title AS scene_title, sc.chapter,
             v.file_path AS scene_video, g.title AS game_title
      FROM saves s
      LEFT JOIN scenes sc ON s.scene_id = sc.id
      LEFT JOIN videos v ON sc.video_id = v.id
      LEFT JOIN games g ON s.game_id = g.id`;
    let rows;
    if (gameId) {
      [rows] = await pool.query(baseSql + ' WHERE s.user_id = ? AND s.slot = ?', [req.user.id, -gameId]);
    } else {
      [rows] = await pool.query(baseSql + ' WHERE s.user_id = ? AND s.slot <= 0 ORDER BY s.updated_at DESC LIMIT 1', [req.user.id]);
    }
    if (rows.length === 0) return res.json({ save: null });
    res.json({ save: rows[0] });
  } catch (err) {
    console.error('[Saves] 获取自动存档失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 存档（含自动存档 slot=0）
router.post('/', async (req, res) => {
  try {
    const { slot, scene_id, game_id, title, play_time, audio_label, sub_label, scene_history, attributes } = req.body;

    // 场景历史栈（数组），供读档后"返回上一场景"使用
    const historyJson = Array.isArray(scene_history)
      ? JSON.stringify(scene_history.map(Number).filter(Number.isFinite))
      : null;

    // 游戏属性值快照 {attr_id: value}
    const attrJson = (attributes && typeof attributes === 'object' && !Array.isArray(attributes))
      ? JSON.stringify(attributes) : null;

    await pool.query(
      `INSERT INTO saves (user_id, slot, scene_id, game_id, title, play_time, audio_label, sub_label, history_json, attributes_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE scene_id = VALUES(scene_id), game_id = VALUES(game_id),
                               title = VALUES(title), play_time = VALUES(play_time),
                               audio_label = VALUES(audio_label), sub_label = VALUES(sub_label),
                               history_json = VALUES(history_json), attributes_json = VALUES(attributes_json)`,
      [req.user.id, slot ?? 1, scene_id, game_id || null, title || '存档', play_time || 0, audio_label || null, sub_label || null, historyJson, attrJson]
    );

    const [saves] = await pool.query(
      'SELECT id FROM saves WHERE user_id = ? AND slot = ?',
      [req.user.id, slot ?? 1]
    );

    res.json({ message: '存档成功', save_id: saves[0].id });
  } catch (err) {
    console.error('[Saves] 存档失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 读档 - 获取存档详情
router.get('/:id/load', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, sc.title AS scene_title, sc.chapter, sc.is_ending, sc.ending_id,
              sc.video_id, sc.game_id AS scene_game_id,
              v.file_path AS scene_video, g.title AS game_title
       FROM saves s
       LEFT JOIN scenes sc ON s.scene_id = sc.id
       LEFT JOIN videos v ON sc.video_id = v.id
       LEFT JOIN games g ON s.game_id = g.id
       WHERE s.id = ? AND s.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '存档不存在' });

    res.json({ save: rows[0] });
  } catch (err) {
    console.error('[Saves] 读档失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除存档
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM saves WHERE id = ? AND user_id = ? AND slot > 0', [req.params.id, req.user.id]);
    res.json({ message: '存档已删除' });
  } catch (err) {
    console.error('[Saves] 删除存档失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ============ 管理端：查看某用户在各游戏的属性值快照 ============
router.get('/user-attributes/:userId', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId) return res.status(400).json({ error: '用户ID无效' });

    // 该用户的自动档（slot<0 每游戏一份），带游戏名/场景名
    const [saves] = await pool.query(
      `SELECT s.id, s.game_id, s.scene_id, s.attributes_json, s.updated_at,
              g.title AS game_title, sc.title AS scene_title
       FROM saves s
       LEFT JOIN games g ON s.game_id = g.id
       LEFT JOIN scenes sc ON s.scene_id = sc.id
       WHERE s.user_id = ? AND s.slot < 0 AND s.game_id IS NOT NULL
       ORDER BY s.updated_at DESC`,
      [userId]
    );

    const games = [];
    for (const s of saves) {
      let attrs = [];
      try {
        const snap = s.attributes_json ? JSON.parse(s.attributes_json) : null;
        if (snap && typeof snap === 'object') {
          // 属性名按游戏定义补全（删除过的属性显示 attr_id）
          const [defs] = await pool.query(
            'SELECT id, name FROM game_attributes WHERE game_id = ?',
            [s.game_id]);
          const nameOf = new Map(defs.map(d => [String(d.id), d.name]));
          attrs = Object.entries(snap).map(([attrId, value]) => ({
            attr_id: Number(attrId),
            name: nameOf.get(String(attrId)) || ('属性#' + attrId),
            value
          }));
        }
      } catch { /* 坏 JSON 跳过 */ }
      games.push({
        game_id: s.game_id, game_title: s.game_title,
        scene_id: s.scene_id, scene_title: s.scene_title,
        updated_at: s.updated_at, attrs
      });
    }
    res.json({ games });
  } catch (err) {
    console.error('[Saves] 用户属性查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
