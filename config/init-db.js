/**
 * 数据库自动初始化 - 互动影像游戏 plot_game
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
  const dbConfig = {
    host: process.env.DB_HOST || '192.168.9.2',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    charset: 'utf8mb4',
    connectTimeout: 10000
  };
  const dbName = process.env.DB_NAME || 'plot_game';
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('[InitDB] MySQL 连接成功');

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);
    console.log('[InitDB] 数据库已就绪:', dbName);

    // ============ 1. 用户表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(100) DEFAULT NULL,
        avatar VARCHAR(500) DEFAULT NULL,
        role ENUM('admin', 'editor', 'player') NOT NULL DEFAULT 'player',
        gender ENUM('male','female','other') DEFAULT NULL COMMENT '性别',
        age TINYINT UNSIGNED DEFAULT NULL COMMENT '年龄',
        preferences VARCHAR(500) DEFAULT NULL COMMENT '喜好标签',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ============ 2. 角色表 (女主角) ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        avatar VARCHAR(500) DEFAULT NULL,
        avatar_pic VARCHAR(500) DEFAULT NULL COMMENT '角色立绘/展示图',
        description TEXT,
        personality VARCHAR(255) COMMENT '性格标签',
        color VARCHAR(7) DEFAULT '#e91e63' COMMENT '主题色',
        sort_order INT DEFAULT 0,
        is_hidden TINYINT(1) DEFAULT 0 COMMENT '隐藏角色',
        voice_actor VARCHAR(100) DEFAULT NULL,
        birthday VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ============ 3. 结局表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS endings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        title_i18n TEXT DEFAULT NULL COMMENT '多语言标题 JSON',
        description TEXT,
        image VARCHAR(500) DEFAULT NULL,
        type ENUM('perfect', 'good', 'normal', 'bad', 'hidden') DEFAULT 'normal',
        character_id INT DEFAULT NULL COMMENT '关联角色',
        unlock_condition TEXT COMMENT '解锁条件描述',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // ============ 4. 游戏表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        title_i18n TEXT DEFAULT NULL COMMENT '多语言标题 JSON',
        cover_image VARCHAR(500) DEFAULT NULL COMMENT '封面图路径',
        description TEXT COMMENT '游戏描述',
        description_i18n TEXT DEFAULT NULL COMMENT '多语言描述 JSON',
        category VARCHAR(100) DEFAULT NULL COMMENT '分类标签',
        sort_order INT DEFAULT 0,
        is_published TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ============ 5. 视频表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        title_i18n TEXT DEFAULT NULL COMMENT '多语言标题 JSON',
        description TEXT,
        filename VARCHAR(500) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT DEFAULT 0,
        mime_type VARCHAR(100) DEFAULT 'video/mp4',
        transcode_status VARCHAR(20) DEFAULT 'none' COMMENT 'none|queued|transcoding|done|failed',
        duration FLOAT DEFAULT 0,
        thumbnail VARCHAR(500) DEFAULT NULL,
        uploaded_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // ============ 6. 场景表 (剧情节点) ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS scenes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        title_i18n TEXT DEFAULT NULL COMMENT '多语言标题 JSON',
        description TEXT,
        chapter VARCHAR(50) DEFAULT NULL COMMENT '章节名 (第1章/第2章...)',
        is_start TINYINT(1) DEFAULT 0 COMMENT '是否初始场景',
        is_ending TINYINT(1) DEFAULT 0 COMMENT '是否结局场景',
        ending_id INT DEFAULT NULL COMMENT '若为结局,关联结局ID',
        choice_timer INT DEFAULT 10 COMMENT '选择倒计时(秒),0=不限时',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (ending_id) REFERENCES endings(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // ============ 7. 选择项表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS choices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scene_id INT NOT NULL,
        text VARCHAR(500) NOT NULL COMMENT '选项文本',
        text_i18n TEXT DEFAULT NULL COMMENT '多语言选项文本 JSON',
        next_scene_id INT DEFAULT NULL COMMENT '跳转目标场景(NULL=停留)',
        sort_order INT DEFAULT 0,
        timer_seconds INT DEFAULT 0 COMMENT '此项单独倒计时,0=使用场景默认',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
        FOREIGN KEY (next_scene_id) REFERENCES scenes(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // ============ 8. 好感度规则表 (选择 -> 角色好感变化) ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS affection_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        choice_id INT NOT NULL,
        character_id INT NOT NULL,
        delta INT NOT NULL DEFAULT 0 COMMENT '好感度变化值 (正数+ 负数-)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (choice_id) REFERENCES choices(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        UNIQUE KEY unique_choice_char (choice_id, character_id)
      ) ENGINE=InnoDB
    `);

    // ============ 9. 条件表 (解锁条件) ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS conditions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_type ENUM('choice', 'scene') NOT NULL,
        target_id INT NOT NULL,
        character_id INT NOT NULL COMMENT '关联角色',
        attr_name VARCHAR(50) NOT NULL DEFAULT 'affection' COMMENT '属性名(affection=好感度)',
        operator ENUM('>=', '<=', '>', '<', '=', '!=') NOT NULL DEFAULT '>=',
        value INT NOT NULL DEFAULT 0 COMMENT '阈值',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ============ 10. 存档表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS saves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        slot INT NOT NULL DEFAULT 1 COMMENT '存档位 1-9',
        scene_id INT DEFAULT NULL COMMENT '当前场景',
        title VARCHAR(255) DEFAULT NULL COMMENT '存档标题',
        screenshot VARCHAR(500) DEFAULT NULL,
        play_time INT DEFAULT 0 COMMENT '已玩时间(秒)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_slot (user_id, slot)
      ) ENGINE=InnoDB
    `);

    // ============ 11. 存档好感度快照 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS save_affection (
        id INT AUTO_INCREMENT PRIMARY KEY,
        save_id INT NOT NULL,
        character_id INT NOT NULL,
        value INT NOT NULL DEFAULT 0,
        FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        UNIQUE KEY unique_save_char (save_id, character_id)
      ) ENGINE=InnoDB
    `);

    // ============ 12. 结局收集表 (玩家解锁了哪些结局) ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS player_endings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ending_id INT NOT NULL,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (ending_id) REFERENCES endings(id) ON DELETE CASCADE,
        UNIQUE KEY unique_player_ending (user_id, ending_id)
      ) ENGINE=InnoDB
    `);

    // ============ 13. 积分字段 (users.points) ============
    try {
      const [pCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='points'", [dbName]);
      if (pCols.length === 0) {
        await conn.query("ALTER TABLE users ADD COLUMN points INT DEFAULT 0 COMMENT '积分余额' AFTER role");
        console.log('[InitDB] 已为 users 表添加 points 字段');
      }
    } catch (e) { console.warn('[InitDB] 添加 points 字段失败 (可能已存在):', e.message); }

    // ============ 13b. choices 表添加 point_cost 字段 ============
    try {
      const [cCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='choices' AND COLUMN_NAME='point_cost'", [dbName]);
      if (cCols.length === 0) {
        await conn.query("ALTER TABLE choices ADD COLUMN point_cost INT DEFAULT 0 COMMENT '选择消耗积分' AFTER timer_seconds");
        console.log('[InitDB] 已为 choices 表添加 point_cost 字段');
      }
    } catch (e) { console.warn('[InitDB] 添加 point_cost 字段失败 (可能已存在):', e.message); }

    // ============ 14. 充值记录表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS recharge_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL COMMENT '充值金额',
        points INT NOT NULL COMMENT '获得积分',
        payment_method VARCHAR(50) DEFAULT 'manual' COMMENT '支付方式',
        status ENUM('pending','completed','cancelled') DEFAULT 'completed',
        operator_id INT DEFAULT NULL COMMENT '操作管理员',
        remark VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // ============ 15. 积分流水表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS points_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        points INT NOT NULL COMMENT '变动积分(正=获得,负=消费)',
        type ENUM('recharge','choice','admin','refund') NOT NULL,
        ref_id INT DEFAULT NULL COMMENT '关联ID(choice_id/recharge_id等)',
        balance INT NOT NULL COMMENT '变动后余额',
        remark VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    console.log('[InitDB] 15 张数据表(含积分体系)创建/确认完成');

    // ============ 迁移: 为 videos 和 scenes 添加 game_id 字段 ============
    try {
      // videos 表添加 game_id
      const [vCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='videos' AND COLUMN_NAME='game_id'", [dbName]);
      if (vCols.length === 0) {
        await conn.query('ALTER TABLE videos ADD COLUMN game_id INT DEFAULT NULL AFTER description');
        await conn.query('ALTER TABLE videos ADD FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL');
        console.log('[InitDB] 已为 videos 表添加 game_id 字段');
      }
      // scenes 表添加 game_id
      const [sCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='scenes' AND COLUMN_NAME='game_id'", [dbName]);
      if (sCols.length === 0) {
        await conn.query('ALTER TABLE scenes ADD COLUMN game_id INT DEFAULT NULL AFTER description');
        await conn.query('ALTER TABLE scenes ADD FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL');
        console.log('[InitDB] 已为 scenes 表添加 game_id 字段');
      }
    } catch (e) {
      console.warn('[InitDB] 迁移 game_id 字段失败 (可能已存在):', e.message);
    }

    // 创建默认管理员
    const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', [adminUser]);
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash(adminPass, 10);
      await conn.query(
        'INSERT INTO users (username, password_hash, role, nickname) VALUES (?, ?, ?, ?)',
        [adminUser, passwordHash, 'admin', '系统管理员']
      );
      console.log('[InitDB] 默认管理员已创建');
      console.log('  ├─ 用户名:', adminUser);
      console.log('  └─ 密码:', adminPass);
    }

    // 插入初始角色数据（示例）
    const [chars] = await conn.query('SELECT COUNT(*) AS cnt FROM characters');
    if (chars[0].cnt === 0) {
      const sampleCharacters = [
        ['林雨晴', '#ff6b9d', '温柔体贴的邻家女孩，大学时期的好友', '温柔/善良/害羞', 1],
        ['苏若雪', '#7c3aed', '冷艳高傲的公司总裁，冰山美人', '高冷/强势/优雅', 2],
        ['赵小曼', '#f59e0b', '活泼开朗的运动系学妹', '阳光/开朗/直率', 3],
        ['陈思涵', '#06b6d4', '神秘莫测的转校生，似乎藏着秘密', '神秘/聪慧/冷静', 4],
        ['周雅琪', '#ec4899', '知性优雅的咖啡店老板娘', '成熟/知性/温柔', 5],
        ['沈月', '#10b981', '古灵精怪的童年玩伴，乐团主唱', '活泼/叛逆/勇敢', 6]
      ];
      for (const ch of sampleCharacters) {
        await conn.query(
          'INSERT INTO characters (name, color, description, personality, sort_order) VALUES (?, ?, ?, ?, ?)',
          ch
        );
      }
      console.log('[InitDB] 初始角色数据已插入 (6位女主角)');
    }

    console.log('[InitDB] 数据库初始化完成!');
  } catch (err) {
    console.error('[InitDB] 数据库初始化失败:', err.message);
    console.error('[InitDB] 请检查数据库连接: ' + dbConfig.host + ':' + dbConfig.port);
  } finally {
    if (conn) await conn.end();
  }
}

module.exports = initDatabase;
