const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 获取某场景的所有选择
router.get('/scene/:sceneId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, ns.title AS next_scene_title
      FROM choices c
      LEFT JOIN scenes ns ON c.next_scene_id = ns.id
      WHERE c.scene_id = ?
      ORDER BY c.sort_order ASC
    `, [req.params.sceneId]);

    for (const choice of rows) {
      const [affRules] = await pool.query(`
        SELECT ar.*, ch.name AS character_name, ch.color
        FROM affection_rules ar JOIN characters ch ON ar.character_id = ch.id
        WHERE ar.choice_id = ?
      `, [choice.id]);
      choice.affection_rules = affRules;

      const [conds] = await pool.query(`
        SELECT cd.*, ch.name AS character_name
        FROM conditions cd JOIN characters ch ON cd.character_id = ch.id
        WHERE cd.target_type = 'choice' AND cd.target_id = ?
      `, [choice.id]);
      choice.conditions = conds;
    }

    res.json({ choices: rows });
  } catch (err) {
    console.error('[Choices] 获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建选择项
router.post('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { scene_id, text, next_scene_id, sort_order, timer_seconds, point_cost } = req.body;
    if (!scene_id || !text) return res.status(400).json({ error: '场景ID和选项文本不能为空' });

    // 校验 next_scene_id 与当前场景同 game_id（避免跨游戏跳转）
    if (next_scene_id) {
      const [curRows] = await pool.query('SELECT game_id FROM scenes WHERE id = ?', [scene_id]);
      const [nextRows] = await pool.query('SELECT game_id FROM scenes WHERE id = ?', [next_scene_id]);
      if (nextRows.length === 0) return res.status(400).json({ error: '跳转目标场景不存在' });
      const curGame = curRows[0]?.game_id;
      const nextGame = nextRows[0]?.game_id;
      if (curGame && nextGame && curGame !== nextGame) {
        return res.status(400).json({ error: `跳转场景归属于其他游戏（game_id=${nextGame}），不能跨游戏跳转` });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO choices (scene_id, text, next_scene_id, sort_order, timer_seconds, point_cost) VALUES (?, ?, ?, ?, ?, ?)',
      [scene_id, text, next_scene_id || null, sort_order || 0, timer_seconds || 0, point_cost || 0]
    );
    res.status(201).json({ message: '选择项创建成功', choice: { id: result.insertId, text } });
  } catch (err) {
    console.error('[Choices] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新选择项
router.put('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { text, next_scene_id, sort_order, timer_seconds, point_cost } = req.body;

    // 若修改 next_scene_id，校验与当前选项所属场景同 game_id
    if (next_scene_id !== undefined && next_scene_id) {
      // 取选项所属场景的 game_id
      const [cRows] = await pool.query(
        'SELECT s.game_id FROM choices c JOIN scenes s ON c.scene_id = s.id WHERE c.id = ?',
        [req.params.id]
      );
      if (cRows.length === 0) return res.status(404).json({ error: '选项不存在' });
      const [nextRows] = await pool.query('SELECT game_id FROM scenes WHERE id = ?', [next_scene_id]);
      if (nextRows.length === 0) return res.status(400).json({ error: '跳转目标场景不存在' });
      const curGame = cRows[0]?.game_id;
      const nextGame = nextRows[0]?.game_id;
      if (curGame && nextGame && curGame !== nextGame) {
        return res.status(400).json({ error: `跳转场景归属于其他游戏（game_id=${nextGame}），不能跨游戏跳转` });
      }
    }

    const fields = []; const values = [];
    if (text !== undefined) { fields.push('text = ?'); values.push(text); }
    if (next_scene_id !== undefined) { fields.push('next_scene_id = ?'); values.push(next_scene_id || null); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order)); }
    if (timer_seconds !== undefined) { fields.push('timer_seconds = ?'); values.push(parseInt(timer_seconds)); }
    if (point_cost !== undefined) { fields.push('point_cost = ?'); values.push(parseInt(point_cost)); }
    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
    values.push(req.params.id);
    await pool.query(`UPDATE choices SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '选择项更新成功' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除选择项
router.delete('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    await pool.query('DELETE FROM affection_rules WHERE choice_id = ?', [req.params.id]);
    await pool.query('DELETE FROM conditions WHERE target_type = "choice" AND target_id = ?', [req.params.id]);
    const [result] = await pool.query('DELETE FROM choices WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: '选择项不存在' });
    res.json({ message: '选择项已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ========= 好感度规则 =========

// 设置选择项的好感度影响
router.post('/:id/affection', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const choiceId = req.params.id;
    const { rules } = req.body; // [{ character_id, delta }, ...]
    if (!rules || !Array.isArray(rules)) return res.status(400).json({ error: '请提供 rules 数组' });

    // 先删除旧规则
    await pool.query('DELETE FROM affection_rules WHERE choice_id = ?', [choiceId]);

    for (const r of rules) {
      if (r.delta === 0) continue; // 跳过0值
      await pool.query(
        'INSERT INTO affection_rules (choice_id, character_id, delta) VALUES (?, ?, ?)',
        [choiceId, r.character_id, r.delta]
      );
    }
    res.json({ message: '好感度规则设置成功' });
  } catch (err) {
    console.error('[Affection] 设置失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ========= 条件管理 =========

// 为选择项或场景设置条件
router.post('/conditions', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { target_type, target_id, character_id, attr_name, operator, value } = req.body;
    const [result] = await pool.query(
      `INSERT INTO conditions (target_type, target_id, character_id, attr_name, operator, value)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [target_type, target_id, character_id, attr_name || 'affection', operator || '>=', value || 0]
    );
    res.status(201).json({ message: '条件创建成功', condition: { id: result.insertId } });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除条件
router.delete('/conditions/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    await pool.query('DELETE FROM conditions WHERE id = ?', [req.params.id]);
    res.json({ message: '条件已删除' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
