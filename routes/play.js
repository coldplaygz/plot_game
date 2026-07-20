/**
 * 游戏核心播放 API
 * 这是游戏客户端的主接口 - 获取当前场景 + 选项 + 好感度
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/play/start
 * 开始新游戏 - 返回起始场景
 */
router.get('/start', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, v.file_path, v.duration, v.mime_type
      FROM scenes s
      JOIN videos v ON s.video_id = v.id
      WHERE s.is_start = 1
      LIMIT 1
    `);

    if (rows.length === 0) {
      return res.status(404).json({ error: '没有设置起始场景，请先在管理后台设置' });
    }

    const scene = rows[0];
    scene.choices = await getSceneChoices(scene.id, {});

    // choice_delay 未设置时默认取视频完整时长
    if ((!scene.choice_delay || scene.choice_delay === 0) && scene.choices.length > 0) {
      scene.choice_delay = Math.floor(scene.duration || 0);
    }

    // 返回所有角色初始好感度（0）
    const [characters] = await pool.query(
      'SELECT id, name, color, avatar FROM characters WHERE is_hidden = 0 ORDER BY sort_order'
    );
    scene.characters = characters.map(c => ({ ...c, affection: 0 }));

    // 移除旧的自动存档（slot 0 为自动存档）
    await pool.query('DELETE FROM saves WHERE user_id = ? AND slot = 0', [req.user.id]);

    res.json({
      scene,
      is_new_game: true,
      message: '新游戏开始'
    });
  } catch (err) {
    console.error('[Play] 开始游戏失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * GET /api/play/scene/:sceneId
 * 获取指定场景的播放数据（含选项）
 * Query: ?affections={"1":10,"2":-5}  当前好感度JSON
 */
router.get('/scene/:sceneId', async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);

    // 解析当前好感度
    let currentAffections = {};
    try {
      currentAffections = JSON.parse(req.query.affections || '{}');
    } catch (e) { /* ignore */ }

    const [rows] = await pool.query(`
      SELECT s.*, v.file_path, v.duration, v.mime_type
      FROM scenes s
      JOIN videos v ON s.video_id = v.id
      WHERE s.id = ?
    `, [sceneId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: '场景不存在' });
    }

    const scene = rows[0];
    scene.choices = await getSceneChoices(sceneId, currentAffections);
    
    // 音轨 & 字幕
    const [audios] = await pool.query('SELECT * FROM video_audios WHERE video_id = ? ORDER BY is_default DESC', [scene.video_id]);
    const [subtitles] = await pool.query('SELECT * FROM video_subtitles WHERE video_id = ? ORDER BY is_default DESC', [scene.video_id]);
    scene.audios = audios;
    scene.subtitles = subtitles;
    
    // choice_delay 未设置时默认取视频完整时长
    if ((!scene.choice_delay || scene.choice_delay === 0) && scene.choices.length > 0) {
      scene.choice_delay = Math.floor(scene.duration || 0);
    }

    // 角色好感度状态
    const [characters] = await pool.query(
      'SELECT id, name, color, avatar FROM characters WHERE is_hidden = 0 ORDER BY sort_order'
    );
    scene.characters = characters.map(c => ({
      ...c,
      affection: currentAffections[c.id] || 0
    }));

    // 如果是结局场景
    if (scene.is_ending && scene.ending_id) {
      const [ending] = await pool.query(`
        SELECT e.*, c.name AS character_name
        FROM endings e LEFT JOIN characters c ON e.character_id = c.id
        WHERE e.id = ?
      `, [scene.ending_id]);
      if (ending.length > 0) {
        scene.ending = ending[0];
        // 自动解锁结局
        await pool.query(
          'INSERT IGNORE INTO player_endings (user_id, ending_id) VALUES (?, ?)',
          [req.user.id, scene.ending_id]
        );
      }
    }

    res.json({ scene });
  } catch (err) {
    console.error('[Play] 获取场景失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/play/choose
 * 玩家做出选择 - 返回好感度变化 + 下一场景
 * Body: { choice_id, scene_id, affections: {"1":10,...} }
 */
router.post('/choose', async (req, res) => {
  try {
    const { choice_id, scene_id, affections } = req.body;
    if (!choice_id) return res.status(400).json({ error: '请提供选择项ID' });

    // 获取选择项信息
    const [choices] = await pool.query(
      'SELECT * FROM choices WHERE id = ? AND scene_id = ?',
      [choice_id, scene_id]
    );
    if (choices.length === 0) return res.status(404).json({ error: '选择项无效' });

    const choice = choices[0];

    // 计算好感度变化
    const currentAffections = { ...(affections || {}) };
    const affectionChanges = [];

    const [rules] = await pool.query(`
      SELECT ar.*, c.name AS character_name, c.color
      FROM affection_rules ar
      JOIN characters c ON ar.character_id = c.id
      WHERE ar.choice_id = ?
    `, [choice.id]);

    for (const rule of rules) {
      const charId = String(rule.character_id);
      const oldVal = currentAffections[charId] || 0;
      const newVal = oldVal + rule.delta;
      currentAffections[charId] = newVal;
      affectionChanges.push({
        character_id: rule.character_id,
        character_name: rule.character_name,
        color: rule.color,
        delta: rule.delta,
        old_value: oldVal,
        new_value: newVal
      });
    }

    // 响应
    const response = {
      choice_id: choice.id,
      choice_text: choice.text,
      next_scene_id: choice.next_scene_id,
      affections: currentAffections,
      affection_changes: affectionChanges,
      is_ending: !choice.next_scene_id // 没有下一场景=结束
    };

    res.json(response);
  } catch (err) {
    console.error('[Play] 选择失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * 获取场景的选择项（含条件过滤）
 */
async function getSceneChoices(sceneId, affections) {
  const [allChoices] = await pool.query(`
    SELECT c.*, ns.title AS next_scene_title
    FROM choices c
    LEFT JOIN scenes ns ON c.next_scene_id = ns.id
    WHERE c.scene_id = ?
    ORDER BY c.sort_order ASC
  `, [sceneId]);

  const validChoices = [];

  for (const choice of allChoices) {
    // 检查条件
    const [conditions] = await pool.query(`
      SELECT cd.*, c.name AS character_name
      FROM conditions cd
      JOIN characters c ON cd.character_id = c.id
      WHERE cd.target_type = 'choice' AND cd.target_id = ?
    `, [choice.id]);

    let isAvailable = true;
    for (const cond of conditions) {
      const playerVal = affections[String(cond.character_id)] || 0;
      const threshold = cond.value;
      switch (cond.operator) {
        case '>=': isAvailable = playerVal >= threshold; break;
        case '<=': isAvailable = playerVal <= threshold; break;
        case '>':  isAvailable = playerVal > threshold; break;
        case '<':  isAvailable = playerVal < threshold; break;
        case '=':  isAvailable = playerVal === threshold; break;
        case '!=': isAvailable = playerVal !== threshold; break;
      }
      if (!isAvailable) break;
    }

    if (isAvailable) {
      // 附加好感度预览（但不显示具体数值，只显示会影响谁）
      const [rules] = await pool.query(`
        SELECT ar.delta, c.name AS character_name
        FROM affection_rules ar
        JOIN characters c ON ar.character_id = c.id
        WHERE ar.choice_id = ?
      `, [choice.id]);

      validChoices.push({
        id: choice.id,
        text: choice.text,
        timer_seconds: choice.timer_seconds,
        affection_hint: rules.map(r => ({
          character_name: r.character_name,
          direction: r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'none'
        }))
      });
    }
  }

  return validChoices;
}

module.exports = router;
