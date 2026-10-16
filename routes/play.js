/**
 * 游戏核心播放 API
 * 这是游戏客户端的主接口 - 获取当前场景 + 选项 + 好感度
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { deductPoints, deductPointsOnce } = require('../services/pointsService');

const router = express.Router();
router.use(authenticate);

// 维护模式检查
router.use(async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT config_value FROM system_config WHERE config_key='maintenance_mode'");
    if (rows[0]?.config_value === '1' && req.user?.role !== 'admin') {
      return res.status(503).json({ error: '系统维护中，请稍后再试' });
    }
  } catch (e) { /* ignore */ }
  next();
});

// 多语言翻译辅助
function t(i18nJson, lang) {
  if (!lang || lang === 'zh' || !i18nJson) return null;
  try {
    const dict = typeof i18nJson === 'string' ? JSON.parse(i18nJson) : i18nJson;
    return dict[lang] || null;
  } catch { return null; }
}

// 规范化 HLS 路径为 / 开头的 URL
function normalizeHlsUrl(p) {
  if (!p) return '';
  return '/' + String(p).replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * GET /api/play/start
 * 开始新游戏 - 返回起始场景
 * Query: ?game_id=N  指定游戏ID (多游戏时必填)
 */
router.get('/start', async (req, res) => {
  try {
    const gameId = req.query.game_id ? parseInt(req.query.game_id) : null;

    // 指定 game_id 时校验游戏是否已发布
    if (gameId) {
      const [gRows] = await pool.query('SELECT id FROM games WHERE id = ? AND is_published = 1', [gameId]);
      if (gRows.length === 0) {
        return res.status(404).json({ error: '游戏不存在或未发布' });
      }
    }

    // 构建查询条件
    let whereClause = 'WHERE s.is_start = 1';
    const params = [];
    if (gameId) {
      whereClause += ' AND s.game_id = ?';
      params.push(gameId);
    }
    // 未指定 game_id：只返回已发布游戏的起始场景
    if (!gameId) {
      whereClause += ' AND (s.game_id IS NULL OR EXISTS (SELECT 1 FROM games g WHERE g.id = s.game_id AND g.is_published = 1))';
    }

    const [rows] = await pool.query(`
      SELECT s.*, v.file_path, v.duration, v.mime_type, v.transcode_status,
             v.hls_master_path, v.hls_status
      FROM scenes s
      JOIN videos v ON s.video_id = v.id
      ${whereClause}
      LIMIT 1
    `, params);

    // 如果没有找到起始场景，且未指定 game_id，检查游戏数量
    if (rows.length === 0) {
      const [games] = await pool.query('SELECT COUNT(*) AS cnt FROM games WHERE is_published = 1');
      if (games[0].cnt > 1 && !gameId) {
        return res.status(400).json({
          error: '存在多个游戏，请指定 game_id 参数',
          games_count: games[0].cnt
        });
      }
      return res.status(404).json({ error: '没有设置起始场景，请先在管理后台设置' });
    }

    const lang = req.query.lang || '';
    const scene = rows[0];
    scene.choices = await getSceneChoices(scene.id, {}, lang, req.user.id);

    // 翻译场景标题
    const sceneTitleI18n = t(scene.title_i18n, lang);
    if (sceneTitleI18n) scene.title = sceneTitleI18n;

    // choice_delay 未设置时默认取视频完整时长
    if ((!scene.choice_delay || scene.choice_delay === 0) && scene.choices.length > 0) {
      scene.choice_delay = Math.floor(scene.duration || 0);
    }

    // 返回所有角色初始好感度（0）
    const [characters] = await pool.query(
      'SELECT id, name, color, avatar FROM characters WHERE is_hidden = 0 ORDER BY sort_order'
    );
    scene.characters = characters.map(c => ({ ...c, affection: 0 }));

    // 音轨 & 字幕
    const [audios] = await pool.query('SELECT id, language, label, file_path, is_default, hls_playlist_path, hls_status FROM video_audios WHERE video_id = ? ORDER BY is_default DESC', [scene.video_id]);
    const [subtitles] = await pool.query('SELECT id, language, label, file_path, is_default, hls_playlist_path, hls_status FROM video_subtitles WHERE video_id = ? ORDER BY is_default DESC', [scene.video_id]);
    // 补充 HLS URL 供前端使用
    scene.hls_url = scene.hls_status === 'done' ? normalizeHlsUrl(scene.hls_master_path) : '';
    scene.audios = audios.map(a => ({ ...a, hls_url: normalizeHlsUrl(a.hls_playlist_path) }));
    scene.subtitles = subtitles.map(s => ({ ...s, hls_url: normalizeHlsUrl(s.hls_playlist_path) }));

    // 移除旧的自动存档（slot 0 为自动存档）
    await pool.query('DELETE FROM saves WHERE user_id = ? AND slot = 0', [req.user.id]);

    // 加载游戏关联的选项主题样式
    let themeConfig = null;
    if (scene.game_id) {
      const [themeRows] = await pool.query(
        `SELECT ct.style_config FROM games g JOIN choice_themes ct ON g.theme_id = ct.id WHERE g.id = ?`,
        [scene.game_id]
      );
      if (themeRows.length) {
        try { themeConfig = JSON.parse(themeRows[0].style_config); } catch {}
      }
    }

    res.json({
      scene,
      is_new_game: true,
      message: '新游戏开始',
      theme_config: themeConfig,
      transcode_warning: scene.transcode_status !== 'done' ? '该视频正在转码中，播放可能出现兼容性问题' : null
    });
  } catch (err) {
    console.error('[Play] 开始游戏失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * 加载场景完整数据（场景 + 选项 + 音轨字幕 + 好感度 + 结局）
 * 供 GET /scene/:sceneId 与 POST /backtrack 共用
 */
async function loadSceneData(sceneId, userId, lang = '', affections = {}) {
  const currentAffections = { ...affections };

  const [rows] = await pool.query(`
    SELECT s.*, v.file_path, v.duration, v.mime_type, v.transcode_status,
           v.hls_master_path, v.hls_status
    FROM scenes s
    JOIN videos v ON s.video_id = v.id
    WHERE s.id = ?
  `, [sceneId]);

  if (rows.length === 0) return null;

  const scene = rows[0];
  scene.choices = await getSceneChoices(sceneId, currentAffections, lang, userId);

  // 翻译场景标题
  const sceneTitleI18n = t(scene.title_i18n, lang);
  if (sceneTitleI18n) scene.title = sceneTitleI18n;

  // 音轨 & 字幕
  const [audios] = await pool.query('SELECT id, language, label, file_path, is_default, hls_playlist_path, hls_status FROM video_audios WHERE video_id = ? ORDER BY is_default DESC', [scene.video_id]);
  const [subtitles] = await pool.query('SELECT id, language, label, file_path, is_default, hls_playlist_path, hls_status FROM video_subtitles WHERE video_id = ? ORDER BY is_default DESC', [scene.video_id]);
  // 补充 HLS URL 供前端使用
  scene.hls_url = scene.hls_status === 'done' ? normalizeHlsUrl(scene.hls_master_path) : '';
  scene.audios = audios.map(a => ({ ...a, hls_url: normalizeHlsUrl(a.hls_playlist_path) }));
  scene.subtitles = subtitles.map(s => ({ ...s, hls_url: normalizeHlsUrl(s.hls_playlist_path) }));

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
        [userId, scene.ending_id]
      );
    }
  }

  return scene;
}

/**
 * GET /api/play/scene/:sceneId
 * 获取指定场景的播放数据（含选项）
 * Query: ?affections={"1":10,"2":-5}  当前好感度JSON
 */
router.get('/scene/:sceneId', async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const lang = req.query.lang || '';

    // 解析当前好感度
    let affections = {};
    try {
      affections = JSON.parse(req.query.affections || '{}');
    } catch (e) { /* ignore */ }

    const scene = await loadSceneData(sceneId, req.user.id, lang, affections);
    if (!scene) return res.status(404).json({ error: '场景不存在' });

    res.json({ scene, transcode_warning: scene.transcode_status !== 'done' ? '该视频正在转码中，播放可能出现兼容性问题' : null });
  } catch (err) {
    console.error('[Play] 获取场景失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * POST /api/play/backtrack
 * 返回上一场景 - 扣除积分（数额后台 system_config.backtrack_cost 配置）
 * Body: { to_scene_id }  目标场景（前端历史栈的上一场景）
 */
router.post('/backtrack', async (req, res) => {
  try {
    const toSceneId = parseInt(req.body.to_scene_id);
    if (!toSceneId) return res.status(400).json({ error: '请提供目标场景ID' });

    const userId = req.user.id;
    const lang = req.body.lang || '';

    // 读取回退成本（后台可配，默认 10）
    let cost = 10;
    try {
      const [cfg] = await pool.query("SELECT config_value FROM system_config WHERE config_key='backtrack_cost'");
      if (cfg.length) cost = Math.max(0, parseInt(cfg[0].config_value) || 0);
    } catch (e) { /* 用默认值 */ }

    // 目标场景必须存在
    const [target] = await pool.query('SELECT id FROM scenes WHERE id = ?', [toSceneId]);
    if (target.length === 0) return res.status(404).json({ error: '目标场景不存在' });

    // 扣积分（成本为 0 时免费回退）
    let pointsBalance;
    if (cost > 0) {
      const result = await deductPoints(userId, cost, 'backtrack', toSceneId, `返回上一场景: 场景#${toSceneId}`);
      if (!result.success) {
        return res.status(402).json({
          error: '积分不足',
          required: result.required,
          current: result.current,
          message: result.message
        });
      }
      pointsBalance = result.balance;
    }

    // 加载目标场景完整数据
    const scene = await loadSceneData(toSceneId, userId, lang);
    if (!scene) return res.status(404).json({ error: '场景不存在' });

    res.json({
      scene,
      point_cost: cost,
      points_balance: pointsBalance,
      transcode_warning: scene.transcode_status !== 'done' ? '该视频正在转码中，播放可能出现兼容性问题' : null
    });
  } catch (err) {
    console.error('[Play] 返回上一场景失败:', err);
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

    const userId = req.user.id;

    // 获取选择项信息
    const [choices] = await pool.query(
      'SELECT * FROM choices WHERE id = ? AND scene_id = ?',
      [choice_id, scene_id]
    );
    if (choices.length === 0) return res.status(404).json({ error: '选择项无效' });

    const choice = choices[0];
    const pointCost = choice.point_cost || 0;

    // 幂等扣费：同一选项只扣一次（行锁事务，并发双击不会双扣）
    let alreadyPaid = false;
    let pointsBalance;
    if (pointCost > 0) {
      const result = await deductPointsOnce(userId, pointCost, 'choice', choice.id, `选项消耗: ${choice.text}`);
      if (!result.success) {
        return res.status(402).json({
          error: '积分不足',
          required: result.required,
          current: result.current,
          message: result.message
        });
      }
      alreadyPaid = !!result.alreadyPaid;
      pointsBalance = result.balance;
    }

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
      is_ending: !choice.next_scene_id, // 没有下一场景=结束
      point_cost: pointCost,
      already_paid: alreadyPaid,
      points_consumed: pointCost > 0 && !alreadyPaid
    };

    // 如果消耗了积分，返回最新余额（事务内已取，无需再查）
    if (pointCost > 0 && !alreadyPaid) {
      response.points_balance = pointsBalance;
    }

    res.json(response);
  } catch (err) {
    console.error('[Play] 选择失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * 获取场景的选择项（含条件过滤 + 已付费标记）
 */
async function getSceneChoices(sceneId, affections, lang = '', userId = null) {
  const [allChoices] = await pool.query(`
    SELECT c.*, ns.title AS next_scene_title, ct.style_config AS theme_config
    FROM choices c
    LEFT JOIN scenes ns ON c.next_scene_id = ns.id
    LEFT JOIN choice_themes ct ON c.theme_id = ct.id
    WHERE c.scene_id = ?
    ORDER BY c.sort_order ASC
  `, [sceneId]);

  // 查询玩家已付费的选项（同选项重复选择不再收费）
  const paidSet = new Set();
  if (userId && allChoices.length) {
    const [paidRows] = await pool.query(
      "SELECT DISTINCT ref_id FROM points_log WHERE user_id = ? AND type = 'choice' AND ref_id IN (?)",
      [userId, allChoices.map(c => c.id)]
    );
    paidRows.forEach(r => paidSet.add(r.ref_id));
  }

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
      // 翻译选项文本
      let text = choice.text;
      const textI18n = t(choice.text_i18n, lang);
      if (textI18n) text = textI18n;

      const [rules] = await pool.query(`
        SELECT ar.delta, c.name AS character_name
        FROM affection_rules ar
        JOIN characters c ON ar.character_id = c.id
        WHERE ar.choice_id = ?
      `, [choice.id]);

      validChoices.push({
        id: choice.id,
        text,
        timer_seconds: choice.timer_seconds,
        point_cost: choice.point_cost || 0,
        paid: paidSet.has(choice.id),  // 已付费：重复选择不再收费
        is_auto_jump: !!choice.is_auto_jump,  // 直接跳转：唯一选项时不弹选项卡自动执行
        theme_config: choice.theme_config ? (() => {
          try { return JSON.parse(choice.theme_config); } catch { return null; }
        })() : null,  // 选项级主题（NULL=跟随游戏主题）
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
