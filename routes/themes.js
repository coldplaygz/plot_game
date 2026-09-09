/**
 * 选项主题 API
 * GET    /api/themes          — 列表（admin/editor）
 * GET    /api/themes/:id      — 单个（admin/editor）
 * POST   /api/themes          — 创建（admin/editor）
 * PUT    /api/themes/:id      — 更新（admin/editor）
 * DELETE /api/themes/:id      — 删除（admin，预设主题不可删）
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('admin', 'editor'));

// 列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM choice_themes ORDER BY sort_order ASC, id ASC');
    const themes = rows.map(r => ({
      ...r,
      style_config: typeof r.style_config === 'string' ? JSON.parse(r.style_config) : r.style_config
    }));
    res.json({ themes });
  } catch (err) {
    console.error('[Themes] 获取列表失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 单个
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM choice_themes WHERE id = ?', [parseInt(req.params.id)]);
    if (rows.length === 0) return res.status(404).json({ error: '主题不存在' });
    const theme = rows[0];
    theme.style_config = typeof theme.style_config === 'string' ? JSON.parse(theme.style_config) : theme.style_config;
    res.json({ theme });
  } catch (err) {
    console.error('[Themes] 获取详情失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建
router.post('/', async (req, res) => {
  try {
    const { name, description, style_config } = req.body;
    if (!name) return res.status(400).json({ error: '主题名称不能为空' });
    if (!style_config) return res.status(400).json({ error: '样式配置不能为空' });

    const cfgStr = typeof style_config === 'string' ? style_config : JSON.stringify(style_config);
    const [result] = await pool.query(
      'INSERT INTO choice_themes (name, description, style_config, is_preset, sort_order) VALUES (?, ?, ?, 0, 0)',
      [name, description || null, cfgStr]
    );
    res.status(201).json({ message: '主题创建成功', theme: { id: result.insertId } });
  } catch (err) {
    console.error('[Themes] 创建失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await pool.query('SELECT * FROM choice_themes WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: '主题不存在' });

    const fields = [];
    const values = [];
    if (req.body.name !== undefined) { fields.push('name = ?'); values.push(req.body.name); }
    if (req.body.description !== undefined) { fields.push('description = ?'); values.push(req.body.description); }
    if (req.body.style_config !== undefined) {
      const cfgStr = typeof req.body.style_config === 'string' ? req.body.style_config : JSON.stringify(req.body.style_config);
      fields.push('style_config = ?'); values.push(cfgStr);
    }
    if (req.body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(parseInt(req.body.sort_order)); }

    if (fields.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    values.push(id);
    await pool.query(`UPDATE choice_themes SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ message: '主题更新成功' });
  } catch (err) {
    console.error('[Themes] 更新失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除（预设主题不可删）
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await pool.query('SELECT * FROM choice_themes WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: '主题不存在' });
    if (existing[0].is_preset) return res.status(400).json({ error: '预设主题不可删除' });

    // 检查是否被游戏使用
    const [used] = await pool.query('SELECT COUNT(*) AS cnt FROM games WHERE theme_id = ?', [id]);
    if (used[0].cnt > 0) return res.status(400).json({ error: '该主题正在被游戏使用，无法删除' });

    await pool.query('DELETE FROM choice_themes WHERE id = ?', [id]);
    res.json({ message: '主题已删除' });
  } catch (err) {
    console.error('[Themes] 删除失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
