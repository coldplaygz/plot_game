const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

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

// 获取自动存档（slot 0）
router.get('/auto', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, sc.title AS scene_title, sc.chapter,
             v.file_path AS scene_video, g.title AS game_title
      FROM saves s
      LEFT JOIN scenes sc ON s.scene_id = sc.id
      LEFT JOIN videos v ON sc.video_id = v.id
      LEFT JOIN games g ON s.game_id = g.id
      WHERE s.user_id = ? AND s.slot = 0
    `, [req.user.id]);
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
    const { slot, scene_id, game_id, title, play_time, audio_label, sub_label } = req.body;

    await pool.query(
      `INSERT INTO saves (user_id, slot, scene_id, game_id, title, play_time, audio_label, sub_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE scene_id = VALUES(scene_id), game_id = VALUES(game_id),
                               title = VALUES(title), play_time = VALUES(play_time),
                               audio_label = VALUES(audio_label), sub_label = VALUES(sub_label)`,
      [req.user.id, slot ?? 1, scene_id, game_id || null, title || '存档', play_time || 0, audio_label || null, sub_label || null]
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

module.exports = router;
