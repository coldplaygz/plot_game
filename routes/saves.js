const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// 获取所有存档位
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, sc.title AS scene_title, sc.chapter,
             v.file_path AS scene_video
      FROM saves s
      LEFT JOIN scenes sc ON s.scene_id = sc.id
      LEFT JOIN videos v ON sc.video_id = v.id
      WHERE s.user_id = ?
      ORDER BY s.slot ASC
    `, [req.user.id]);
    res.json({ saves: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 存档
router.post('/', async (req, res) => {
  try {
    const { slot, scene_id, title, screenshot, play_time, affections } = req.body;
    // affections: { character_id: value, ... }

    // 使用 ON DUPLICATE KEY UPDATE 自动处理插入/更新
    await pool.query(
      `INSERT INTO saves (user_id, slot, scene_id, title, screenshot, play_time)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE scene_id = VALUES(scene_id), title = VALUES(title),
                               screenshot = VALUES(screenshot), play_time = VALUES(play_time)`,
      [req.user.id, slot || 1, scene_id, title || '存档', screenshot || null, play_time || 0]
    );

    // 获取存档ID
    const [saves] = await pool.query(
      'SELECT id FROM saves WHERE user_id = ? AND slot = ?',
      [req.user.id, slot || 1]
    );
    const saveId = saves[0].id;

    // 保存好感度快照
    if (affections && typeof affections === 'object') {
      for (const [charId, value] of Object.entries(affections)) {
        await pool.query(
          `INSERT INTO save_affection (save_id, character_id, value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE value = VALUES(value)`,
          [saveId, parseInt(charId), value]
        );
      }
    }

    res.json({ message: '存档成功', save_id: saveId });
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
              sc.video_id, v.file_path AS scene_video
       FROM saves s
       LEFT JOIN scenes sc ON s.scene_id = sc.id
       LEFT JOIN videos v ON sc.video_id = v.id
       WHERE s.id = ? AND s.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '存档不存在' });

    const save = rows[0];

    // 获取好感度
    const [affections] = await pool.query(`
      SELECT sa.character_id, sa.value, c.name, c.color
      FROM save_affection sa
      JOIN characters c ON sa.character_id = c.id
      WHERE sa.save_id = ?
    `, [save.id]);
    save.affections = affections;

    res.json({ save });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除存档
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM saves WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: '存档已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
