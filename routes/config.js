/**
 * 系统配置 API
 * GET /api/config — 公开，获取配置（site_name, footer_text 等）
 * GET /api/config/all — admin，获取全部配置
 * PUT /api/config — admin，批量更新配置
 */
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// 公开接口 — 获取前端需要的配置
router.get('/', async (req, res) => {
  try {
    const keys = ['site_name', 'footer_text', 'default_lang', 'reg_enabled', 'maintenance_mode', 'admin_path', 'points_rate'];
    const [rows] = await pool.query('SELECT config_key, config_value FROM system_config WHERE config_key IN (?)', [keys]);
    const config = {};
    rows.forEach(r => { config[r.config_key] = r.config_value; });
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// Admin — 获取全部配置
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM system_config ORDER BY id');
    res.json({ configs: rows });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// Admin — 批量更新
router.put('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { configs } = req.body;
    if (!configs || !Array.isArray(configs)) return res.status(400).json({ error: '参数错误' });

    for (const item of configs) {
      if (item.config_key && item.config_value !== undefined) {
        await pool.query('UPDATE system_config SET config_value=? WHERE config_key=?', [item.config_value, item.config_key]);
      }
    }
    res.json({ message: '配置已更新' });
  } catch (err) {
    res.status(500).json({ error: '服务器内部错误' });
  }
});

module.exports = router;
