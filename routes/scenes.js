const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 获取所有场景（管理用）
router.get('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const gameId = req.query.game_id ? parseInt(req.query.game_id) : null;

    let whereClause = '';
    const params = [];
    if (gameId) {
      whereClause = ' WHERE s.game_id = ?';
      params.push(gameId);
    }

    const [rows] = await pool.query(`
      SELECT s.*, v.title AS video_title, v.file_path, v.duration,
             e.title AS ending_title,
             g.title AS game_title,
             (SELECT COUNT(*) FROM choices c WHERE c.scene_id = s.id) AS choice_count,
             (SELECT COUNT(*) FROM choices c WHERE c.scene_id = s.id AND c.is_auto_jump = 1) AS auto_jump_count
      FROM scenes s
      LEFT JOIN videos v ON s.video_id = v.id
      LEFT JOIN endings e ON s.ending_id = e.id
      LEFT JOIN games g ON s.game_id = g.id
      ${whereClause}
      ORDER BY s.sort_order ASC
    `, params);
    res.json({ scenes: rows });
  } catch (err) {
    console.error('[Scenes] 获取失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个场景详情（含选择项和好感规则）
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, v.title AS video_title, v.file_path, v.duration, v.mime_type,
             e.title AS ending_title, e.type AS ending_type
      FROM scenes s
      LEFT JOIN videos v ON s.video_id = v.id
      LEFT JOIN endings e ON s.ending_id = e.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ error: '场景不存在' });

    const scene = rows[0];

    // 获取选择项
    const [choices] = await pool.query(`
      SELECT c.*, ns.title AS next_scene_title
      FROM choices c
      LEFT JOIN scenes ns ON c.next_scene_id = ns.id
      WHERE c.scene_id = ?
      ORDER BY c.sort_order ASC
    `, [scene.id]);

    // 获取每个选择的：好感度规则 + 条件
    for (const choice of choices) {
      const [affRules] = await pool.query(`
        SELECT ar.*, ch.name AS character_name, ch.color
        FROM affection_rules ar
        JOIN characters ch ON ar.character_id = ch.id
        WHERE ar.choice_id = ?
      `, [choice.id]);
      choice.affection_rules = affRules;

      const [conds] = await pool.query(`
        SELECT cd.*, ch.name AS character_name
        FROM conditions cd
        JOIN characters ch ON cd.character_id = ch.id
        WHERE cd.target_type = 'choice' AND cd.target_id = ?
      `, [choice.id]);
      choice.conditions = conds;
    }

    scene.choices = choices;
    res.json({ scene });
  } catch (err) {
    console.error('[Scenes] 获取详情失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建场景
router.post('/', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { video_id, title, description, chapter, is_start, is_ending, ending_id, choice_timer, choice_delay, sort_order, game_id } = req.body;
    if (!video_id || !title) return res.status(400).json({ error: '视频ID和标题不能为空' });

    // 校验视频存在并取其 game_id
    const [vRows] = await pool.query('SELECT id, game_id FROM videos WHERE id = ?', [video_id]);
    if (vRows.length === 0) return res.status(400).json({ error: '视频不存在' });

    // 场景 game_id：优先用前端显式传入的，否则跟随视频归属
    let sceneGameId = game_id !== undefined ? (game_id ? parseInt(game_id) : null) : vRows[0].game_id;
    // 若显式指定了 game_id 且视频也有 game_id，必须一致（避免跨游戏引用）
    if (game_id !== undefined && vRows[0].game_id && sceneGameId && sceneGameId !== vRows[0].game_id) {
      return res.status(400).json({ error: `场景 game_id(${sceneGameId}) 与视频归属 game_id(${vRows[0].game_id}) 不一致` });
    }

    // 如果设为起始场景，先清除同游戏下的其他起始场景（避免不同游戏互相覆盖）
    if (is_start) {
      if (sceneGameId) {
        await pool.query('UPDATE scenes SET is_start = 0 WHERE game_id = ?', [sceneGameId]);
      } else {
        await pool.query('UPDATE scenes SET is_start = 0 WHERE game_id IS NULL');
      }
    }

    const [result] = await pool.query(
      `INSERT INTO scenes (video_id, title, title_i18n, description, chapter, is_start, is_ending, ending_id, choice_timer, choice_delay, sort_order, game_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [video_id, title, req.body.title_i18n || null, description || '', chapter || null, is_start ? 1 : 0, is_ending ? 1 : 0,
       ending_id || null, choice_timer || 10, choice_delay || 0, sort_order || 0, sceneGameId]
    );
    res.status(201).json({ message: '场景创建成功', scene: { id: result.insertId, title } });
  } catch (err) {
    console.error('[Scenes] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新场景
router.put('/:id', authenticate, authorize('admin', 'editor'), async (req, res) => {
  try {
    const { video_id, title, description, chapter, is_start, is_ending, ending_id, choice_timer, choice_delay, sort_order, game_id } = req.body;

    // 取当前场景（用于比对 game_id 和 is_start 清除范围）
    const [sRows] = await pool.query('SELECT id, game_id, video_id FROM scenes WHERE id = ?', [req.params.id]);
    if (sRows.length === 0) return res.status(404).json({ error: '场景不存在' });
    const curScene = sRows[0];

    // 计算目标 game_id：
    // - 若传了 game_id，用传入值
    // - 若传了 video_id（换视频），跟随新视频的 game_id
    // - 否则保持当前值
    let sceneGameId = curScene.game_id;
    let needUpdateGameId = false;
    // game_id 是否发生变化（用于兜底清除原 video_id）
    let gameIdChanged = false;

    if (game_id !== undefined) {
      const newGameId = game_id ? parseInt(game_id) : null;
      if (newGameId !== curScene.game_id) {
        gameIdChanged = true;
      }
      sceneGameId = newGameId;
      needUpdateGameId = true;
    }

    // 若更换视频：校验视频存在，且 game_id 与场景 game_id 一致
    if (video_id !== undefined) {
      const [vRows] = await pool.query('SELECT id, game_id FROM videos WHERE id = ?', [video_id]);
      if (vRows.length === 0) return res.status(400).json({ error: '视频不存在' });
      // 场景 game_id 与视频 game_id 必须一致（都为空或相等）
      if (sceneGameId && vRows[0].game_id && vRows[0].game_id !== sceneGameId) {
        return res.status(400).json({ error: `视频归属于其他游戏（game_id=${vRows[0].game_id}），不能跨游戏引用` });
      }
      // 场景 game_id 为空时跟随视频
      if (!sceneGameId && vRows[0].game_id) {
        sceneGameId = vRows[0].game_id;
        needUpdateGameId = true;
      }
    } else if (gameIdChanged && curScene.video_id) {
      // 兜底：game_id 变化但未传 video_id，原视频已不属于新游戏，主动清除 video_id
      // 前端已在确认框后清除，这里防止绕过前端直接调 API
      console.log(`[Scenes] #${req.params.id} game_id 变更(${curScene.game_id}→${sceneGameId})，将清除原 video_id=${curScene.video_id}`);
    }

    if (is_start) {
      // 仅清除同游戏下的其他起始场景
      if (sceneGameId) {
        await pool.query('UPDATE scenes SET is_start = 0 WHERE id != ? AND game_id = ?', [req.params.id, sceneGameId]);
      } else {
        await pool.query('UPDATE scenes SET is_start = 0 WHERE id != ? AND game_id IS NULL', [req.params.id]);
      }
    }

    const fields = [];
    const values = [];
    if (video_id !== undefined) {
      fields.push('video_id = ?'); values.push(video_id);
    } else if (gameIdChanged && curScene.video_id) {
      // 兜底：game_id 变化但未传 video_id，清除原 video_id（原视频已不属于新游戏）
      fields.push('video_id = ?'); values.push(null);
    }
    if (needUpdateGameId) { fields.push('game_id = ?'); values.push(sceneGameId); }
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (chapter !== undefined) { fields.push('chapter = ?'); values.push(chapter); }
    if (is_start !== undefined) { fields.push('is_start = ?'); values.push(is_start ? 1 : 0); }
    if (is_ending !== undefined) { fields.push('is_ending = ?'); values.push(is_ending ? 1 : 0); }
    if (ending_id !== undefined) { fields.push('ending_id = ?'); values.push(ending_id); }
    if (choice_timer !== undefined) { fields.push('choice_timer = ?'); values.push(choice_timer); }
    if (choice_delay !== undefined) { fields.push('choice_delay = ?'); values.push(parseInt(choice_delay)); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(sort_order)); }

    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });
    values.push(req.params.id);
    await pool.query(`UPDATE scenes SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '场景更新成功' });
  } catch (err) {
    console.error('[Scenes] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除场景
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id FROM scenes WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: '场景不存在' });

    await pool.query('DELETE FROM conditions WHERE target_type = "choice" AND target_id IN (SELECT id FROM choices WHERE scene_id = ?)', [req.params.id]);
    await pool.query('DELETE FROM affection_rules WHERE choice_id IN (SELECT id FROM choices WHERE scene_id = ?)', [req.params.id]);
    await pool.query('DELETE FROM choices WHERE scene_id = ?', [req.params.id]);
    await pool.query('DELETE FROM conditions WHERE target_type = "scene" AND target_id = ?', [req.params.id]);
    await pool.query('DELETE FROM scenes WHERE id = ?', [req.params.id]);

    res.json({ message: '场景及关联数据已删除' });
  } catch (err) {
    console.error('[Scenes] 删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
