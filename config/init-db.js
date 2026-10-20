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
        intro_tail_seconds INT DEFAULT 3 COMMENT '开场页封面视频播完后循环播放的尾段秒数，0=整段循环',
        menu_position VARCHAR(20) DEFAULT 'center' COMMENT '开场开始菜单显示位置',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // ============ 4.5 选项主题表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS choice_themes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL COMMENT '主题名称',
        description VARCHAR(200) DEFAULT NULL COMMENT '主题描述',
        style_config TEXT NOT NULL COMMENT '样式JSON: button_bg/border/text, hover_bg/border, number_color, paid_*, cost_*, radius',
        is_preset TINYINT(1) DEFAULT 0 COMMENT '是否预设主题(不可删)',
        sort_order INT DEFAULT 0,
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
        choice_delay INT DEFAULT 0 COMMENT '选项弹出延迟(秒),0=视频结束时',
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
        theme_id INT DEFAULT NULL COMMENT '选项主题ID(NULL=跟随游戏主题)',
        is_auto_jump TINYINT(1) DEFAULT 0 COMMENT '直接跳转:唯一选项时不弹选项卡,选项出现时刻自动执行',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
        FOREIGN KEY (next_scene_id) REFERENCES scenes(id) ON DELETE SET NULL,
        FOREIGN KEY (theme_id) REFERENCES choice_themes(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // ============ 8. 场景对白表 (树状: parent_id 父节点, choice_id 分支条件) ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dialogues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scene_id INT NOT NULL,
        parent_id INT DEFAULT NULL COMMENT '父节点(NULL=根)',
        choice_id INT DEFAULT NULL COMMENT '兼容字段(废弃)',
        node_type ENUM('line','option') NOT NULL DEFAULT 'line' COMMENT 'line=普通对白 option=对白选项(弹出子项供选择)',
        speaker VARCHAR(100) DEFAULT NULL COMMENT '说话人',
        text VARCHAR(1000) NOT NULL COMMENT '对白文本',
        text_i18n TEXT DEFAULT NULL COMMENT '多语言 JSON',
        show_time INT DEFAULT 0 COMMENT '在场景视频第几秒出现',
        duration INT DEFAULT 4 COMMENT '显示时长(秒)',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
        FOREIGN KEY (choice_id) REFERENCES choices(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES dialogues(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ============ 8b. 对白库表 (按游戏预编辑的模板对白树, 场景可整棵导入) ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dialogue_library (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        parent_id INT DEFAULT NULL COMMENT '父节点(NULL=根)',
        node_type ENUM('line','option') NOT NULL DEFAULT 'line' COMMENT 'line=对白 option=提问',
        speaker VARCHAR(100) DEFAULT NULL,
        text VARCHAR(1000) NOT NULL,
        text_i18n TEXT DEFAULT NULL,
        show_time INT DEFAULT 0 COMMENT '建议触发时间(秒),导入场景时填入',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES dialogue_library(id) ON DELETE CASCADE
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
        game_id INT DEFAULT NULL COMMENT '归属游戏',
        audio_label VARCHAR(100) DEFAULT NULL COMMENT '音轨选择',
        sub_label VARCHAR(100) DEFAULT NULL COMMENT '字幕选择',
        title VARCHAR(255) DEFAULT NULL COMMENT '存档标题',
        screenshot VARCHAR(500) DEFAULT NULL,
        play_time INT DEFAULT 0 COMMENT '已玩时间(秒)',
        history_json TEXT DEFAULT NULL COMMENT '场景历史栈JSON（供返回上一场景）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_slot (user_id, slot)
      ) ENGINE=InnoDB
    `);

    // 旧库迁移：saves 表补充 history_json 字段
    try {
      const [hCol] = await conn.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='saves' AND COLUMN_NAME='history_json'",
        [dbName]
      );
      if (!hCol.length) {
        await conn.query("ALTER TABLE saves ADD COLUMN history_json TEXT DEFAULT NULL COMMENT '场景历史栈JSON（供返回上一场景）'");
        console.log('[InitDB] 已为 saves 表补充 history_json 字段');
      }
    } catch (e) { console.warn('[InitDB] saves.history_json 迁移失败 (可能已存在):', e.message); }

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

    // ============ 13c. choices 表添加 theme_id 字段（选项级主题） ============
    try {
      const [cThemeCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='choices' AND COLUMN_NAME='theme_id'", [dbName]);
      if (cThemeCols.length === 0) {
        await conn.query("ALTER TABLE choices ADD COLUMN theme_id INT DEFAULT NULL COMMENT '选项主题ID(NULL=跟随游戏主题)' AFTER point_cost");
        await conn.query('ALTER TABLE choices ADD FOREIGN KEY (theme_id) REFERENCES choice_themes(id) ON DELETE SET NULL');
        console.log('[InitDB] 已为 choices 表添加 theme_id 字段');
      }
    } catch (e) { console.warn('[InitDB] 添加 theme_id 字段失败 (可能已存在):', e.message); }

    // ============ 13d. choices 表添加 is_auto_jump 字段（直接跳转） ============
    try {
      const [ajCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='choices' AND COLUMN_NAME='is_auto_jump'", [dbName]);
      if (ajCols.length === 0) {
        await conn.query("ALTER TABLE choices ADD COLUMN is_auto_jump TINYINT(1) DEFAULT 0 COMMENT '直接跳转:唯一选项时不弹选项卡,选项出现时刻自动执行' AFTER theme_id");
        console.log('[InitDB] 已为 choices 表添加 is_auto_jump 字段');
      }
    } catch (e) { console.warn('[InitDB] 添加 is_auto_jump 字段失败 (可能已存在):', e.message); }

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
        operator_id INT DEFAULT NULL COMMENT '操作管理员',
        points INT NOT NULL COMMENT '变动积分(正=获得,负=消费)',
        type ENUM('recharge','choice','admin','refund','prop','backtrack') NOT NULL,
        ref_id INT DEFAULT NULL COMMENT '关联ID(choice_id/recharge_id等)',
        balance INT NOT NULL COMMENT '变动后余额',
        remark VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    // 旧库迁移：points_log.type 枚举补充 'backtrack'（返回上一场景扣积分）
    try {
      const [plEnum] = await conn.query(
        "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='points_log' AND COLUMN_NAME='type'",
        [dbName]
      );
      if (plEnum.length && !plEnum[0].COLUMN_TYPE.includes('backtrack')) {
        await conn.query("ALTER TABLE points_log MODIFY COLUMN type ENUM('recharge','choice','admin','refund','prop','backtrack') NOT NULL");
        console.log('[InitDB] 已为 points_log.type 枚举补充 backtrack 值');
      }
    } catch (e) { console.warn('[InitDB] points_log 枚举迁移失败 (可能已存在):', e.message); }

    console.log('[InitDB] 15 张数据表(含积分体系)创建/确认完成');

    // ============ 16. 视频音轨表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS video_audios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        language VARCHAR(20) NOT NULL COMMENT '语言代码 zh/en/ja/ko',
        label VARCHAR(100) NOT NULL COMMENT '显示标签',
        file_path VARCHAR(500) NOT NULL COMMENT '音轨源文件路径(.mp3/.m4a)',
        file_size BIGINT DEFAULT 0,
        is_default TINYINT(1) DEFAULT 0,
        hls_playlist_path VARCHAR(500) DEFAULT NULL COMMENT 'HLS 子播放列表 audio_xx.m3u8 路径',
        hls_status VARCHAR(20) DEFAULT 'none' COMMENT 'none|queued|transcoding|done|failed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ============ 17. 视频字幕表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS video_subtitles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        video_id INT NOT NULL,
        language VARCHAR(20) NOT NULL,
        label VARCHAR(100) NOT NULL,
        file_path VARCHAR(500) NOT NULL COMMENT '字幕源文件(.vtt)',
        file_size BIGINT DEFAULT 0,
        is_default TINYINT(1) DEFAULT 0,
        hls_playlist_path VARCHAR(500) DEFAULT NULL COMMENT 'HLS 字幕子播放列表 sub_xx.m3u8 路径',
        hls_status VARCHAR(20) DEFAULT 'none' COMMENT 'none|queued|transcoding|done|failed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    console.log('[InitDB] 音轨/字幕表创建/确认完成');

    // ============ 18. 道具表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS props (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT '道具名称',
        name_i18n JSON DEFAULT NULL COMMENT '多语言名称 {"en":"Egg","ja":"卵"}',
        type ENUM('effect','fantasy') NOT NULL DEFAULT 'effect' COMMENT 'effect=效果道具(动画) fantasy=幻想场景道具(播放视频)',
        icon VARCHAR(10) NOT NULL DEFAULT 'gift' COMMENT '道具图标(emoji)',
        animation VARCHAR(50) DEFAULT NULL COMMENT '效果动画类型 egg/flower/heart/star/tomato/confetti/firework/coin',
        video_id INT DEFAULT NULL COMMENT '幻想场景道具关联的视频',
        scene_id INT DEFAULT NULL COMMENT '绑定的场景(幻想场景道具在该场景才可用,NULL=通用)',
        point_cost INT NOT NULL DEFAULT 0 COMMENT '使用扣除积分',
        sort_order INT NOT NULL DEFAULT 0,
        is_published TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL,
        FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // ============ 19. 道具使用记录表 ============
    await conn.query(`
      CREATE TABLE IF NOT EXISTS prop_usages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        prop_id INT NOT NULL,
        scene_id INT DEFAULT NULL COMMENT '使用时的场景',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (prop_id) REFERENCES props(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('[InitDB] 道具表创建/确认完成');

    // ============ 迁移: 为 videos 表添加 HLS 字段 ============
    try {
      const hlsCols = ['hls_master_path', 'hls_dir', 'hls_status'];
      for (const col of hlsCols) {
        const [ex] = await conn.query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='videos' AND COLUMN_NAME=?",
          [dbName, col]
        );
        if (ex.length === 0) {
          if (col === 'hls_master_path') {
            await conn.query("ALTER TABLE videos ADD COLUMN hls_master_path VARCHAR(500) DEFAULT NULL COMMENT 'HLS master.m3u8 路径' AFTER thumbnail");
          } else if (col === 'hls_dir') {
            await conn.query("ALTER TABLE videos ADD COLUMN hls_dir VARCHAR(500) DEFAULT NULL COMMENT 'HLS 切片目录' AFTER hls_master_path");
          } else if (col === 'hls_status') {
            await conn.query("ALTER TABLE videos ADD COLUMN hls_status VARCHAR(20) DEFAULT 'none' COMMENT 'none|queued|transcoding|done|failed' AFTER hls_dir");
          }
          console.log('[InitDB] 已为 videos 表添加 ' + col + ' 字段');
        }
      }
      // 旧表兼容：若 video_audios/video_subtitles 已存在但缺 hls 字段，补齐
      for (const tbl of ['video_audios', 'video_subtitles']) {
        for (const col of ['hls_playlist_path', 'hls_status']) {
          const [ex] = await conn.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?",
            [dbName, tbl, col]
          );
          if (ex.length === 0) {
            if (col === 'hls_playlist_path') {
              await conn.query(`ALTER TABLE ${tbl} ADD COLUMN hls_playlist_path VARCHAR(500) DEFAULT NULL COMMENT 'HLS 子播放列表路径' AFTER is_default`);
            } else {
              await conn.query(`ALTER TABLE ${tbl} ADD COLUMN hls_status VARCHAR(20) DEFAULT 'none' COMMENT 'none|queued|transcoding|done|failed' AFTER hls_playlist_path`);
            }
            console.log(`[InitDB] 已为 ${tbl} 表添加 ${col} 字段`);
          }
        }
      }
    } catch (e) {
      console.warn('[InitDB] 迁移 HLS 字段失败 (可能已存在):', e.message);
    }

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
      // saves 表添加 game_id
      const [svCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='saves' AND COLUMN_NAME='game_id'", [dbName]);
      if (svCols.length === 0) {
        await conn.query('ALTER TABLE saves ADD COLUMN game_id INT DEFAULT NULL AFTER scene_id');
        await conn.query('ALTER TABLE saves ADD FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL');
        console.log('[InitDB] 已为 saves 表添加 game_id 字段');
      }
      // videos 表添加 category 字段（区分场景视频和封面视频）
      const [vCatCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='videos' AND COLUMN_NAME='category'", [dbName]);
      if (vCatCols.length === 0) {
        await conn.query("ALTER TABLE videos ADD COLUMN category ENUM('scene','cover') NOT NULL DEFAULT 'scene' COMMENT 'scene=游戏场景视频 cover=封面视频' AFTER game_id");
        console.log('[InitDB] 已为 videos 表添加 category 字段');
      }
      // games 表添加开场引导配置（封面尾段循环秒数 + 开始菜单位置）
      const [gTailCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='games' AND COLUMN_NAME='intro_tail_seconds'", [dbName]);
      if (gTailCols.length === 0) {
        await conn.query("ALTER TABLE games ADD COLUMN intro_tail_seconds INT DEFAULT 3 COMMENT '开场页封面视频播完后循环播放的尾段秒数，0=整段循环' AFTER is_published");
        console.log('[InitDB] 已为 games 表添加 intro_tail_seconds 字段');
      }
      const [gMenuCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='games' AND COLUMN_NAME='menu_position'", [dbName]);
      if (gMenuCols.length === 0) {
        await conn.query("ALTER TABLE games ADD COLUMN menu_position VARCHAR(20) DEFAULT 'center' COMMENT '开场开始菜单显示位置' AFTER intro_tail_seconds");
        console.log('[InitDB] 已为 games 表添加 menu_position 字段');
      }
      // games 表添加 cover_video_id 字段（关联封面视频）
      const [gCvCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='games' AND COLUMN_NAME='cover_video_id'", [dbName]);
      if (gCvCols.length === 0) {
        await conn.query("ALTER TABLE games ADD COLUMN cover_video_id INT DEFAULT NULL COMMENT '封面视频ID（优先于cover_image）' AFTER cover_image");
        await conn.query('ALTER TABLE games ADD FOREIGN KEY (cover_video_id) REFERENCES videos(id) ON DELETE SET NULL');
        console.log('[InitDB] 已为 games 表添加 cover_video_id 字段');
      }
      // games 表添加 theme_id 字段（关联选项主题）
      const [gThemeCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='games' AND COLUMN_NAME='theme_id'", [dbName]);
      if (gThemeCols.length === 0) {
        await conn.query("ALTER TABLE games ADD COLUMN theme_id INT DEFAULT NULL COMMENT '选项主题ID' AFTER menu_position");
        await conn.query('ALTER TABLE games ADD FOREIGN KEY (theme_id) REFERENCES choice_themes(id) ON DELETE SET NULL');
        console.log('[InitDB] 已为 games 表添加 theme_id 字段');
      }
      // props 表添加 scene_id（幻想场景道具绑定到具体场景）
      const [pCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='props' AND COLUMN_NAME='scene_id'", [dbName]);
      if (pCols.length === 0) {
        await conn.query('ALTER TABLE props ADD COLUMN scene_id INT DEFAULT NULL COMMENT "绑定的场景(幻想场景道具在该场景才可用,NULL=通用)" AFTER video_id');
        await conn.query('ALTER TABLE props ADD FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE');
        console.log('[InitDB] 已为 props 表添加 scene_id 字段');
      }
    } catch (e) {
      console.warn('[InitDB] 迁移 game_id/scene_id 字段失败 (可能已存在):', e.message);
    }

    // ============ 迁移: 修正 props.type 枚举值（独立 try-catch，避免被前一步外键失败阻断） ============
    try {
      const [pTypeRows] = await conn.query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='props' AND COLUMN_NAME='type'", [dbName]);
      if (pTypeRows.length > 0 && !pTypeRows[0].COLUMN_TYPE.includes('fantasy')) {
        await conn.query("ALTER TABLE props MODIFY COLUMN type ENUM('effect','fantasy') NOT NULL DEFAULT 'effect' COMMENT 'effect=效果道具(动画) fantasy=幻想场景道具(播放视频)'");
        console.log('[InitDB] 已修正 props.type 枚举值（添加 fantasy）');
      }
    } catch (e) {
      console.warn('[InitDB] 修正 props.type 枚举值失败:', e.message);
    }

    // ============ 迁移: 修正 points_log.type 枚举值（添加 'prop' 用于道具消耗） ============
    try {
      const [plTypeRows] = await conn.query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='points_log' AND COLUMN_NAME='type'", [dbName]);
      if (plTypeRows.length > 0 && !plTypeRows[0].COLUMN_TYPE.includes('prop')) {
        await conn.query("ALTER TABLE points_log MODIFY COLUMN type ENUM('recharge','choice','admin','refund','prop') NOT NULL");
        console.log('[InitDB] 已修正 points_log.type 枚举值（添加 prop）');
      }
    } catch (e) {
      console.warn('[InitDB] 修正 points_log.type 枚举值失败:', e.message);
    }

    // ============ 迁移: 补齐旧表缺失字段（scenes.title_i18n / scenes.choice_delay / points_log.operator_id） ============
    try {
      // scenes.title_i18n（多语言标题）
      const [stCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='scenes' AND COLUMN_NAME='title_i18n'", [dbName]);
      if (stCols.length === 0) {
        await conn.query("ALTER TABLE scenes ADD COLUMN title_i18n TEXT DEFAULT NULL COMMENT '多语言标题 JSON' AFTER title");
        console.log('[InitDB] 已为 scenes 表添加 title_i18n 字段');
      }
      // scenes.choice_delay（选项弹出延迟）
      const [sdCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='scenes' AND COLUMN_NAME='choice_delay'", [dbName]);
      if (sdCols.length === 0) {
        await conn.query("ALTER TABLE scenes ADD COLUMN choice_delay INT DEFAULT 0 COMMENT '选项弹出延迟(秒),0=视频结束时' AFTER choice_timer");
        console.log('[InitDB] 已为 scenes 表添加 choice_delay 字段');
      }
      // points_log.operator_id（操作管理员）
      const [poCols] = await conn.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='points_log' AND COLUMN_NAME='operator_id'", [dbName]);
      if (poCols.length === 0) {
        await conn.query("ALTER TABLE points_log ADD COLUMN operator_id INT DEFAULT NULL COMMENT '操作管理员' AFTER user_id");
        await conn.query("ALTER TABLE points_log ADD FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL");
        console.log('[InitDB] 已为 points_log 表添加 operator_id 字段');
      }
    } catch (e) {
      console.warn('[InitDB] 补齐旧表缺失字段失败 (可能已存在):', e.message);
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

    // ============ 预设选项主题 ============
    const [themeCnt] = await conn.query('SELECT COUNT(*) AS cnt FROM choice_themes');
    if (themeCnt[0].cnt === 0) {
      const presetThemes = [
        { name: '暗夜紫', desc: '默认深色主题，紫色悬停', cfg: { button_bg: 'rgba(0,0,0,0.55)', button_border: 'rgba(255,255,255,0.15)', button_text: '#ffffff', hover_bg: 'rgba(139,92,246,0.4)', hover_border: '#8b5cf6', number_color: '#9ca3af', paid_bg: 'rgba(74,222,128,0.15)', paid_text: '#4ade80', paid_border: 'rgba(74,222,128,0.3)', cost_bg: 'rgba(251,191,36,0.15)', cost_text: '#fbbf24', cost_border: 'rgba(251,191,36,0.3)', radius: '8px' } },
        { name: '霓虹粉', desc: '赛博朋克风，粉色霓虹光', cfg: { button_bg: 'rgba(20,5,30,0.7)', button_border: 'rgba(236,72,153,0.4)', button_text: '#fce7f3', hover_bg: 'rgba(236,72,153,0.35)', hover_border: '#ec4899', number_color: '#f9a8d4', paid_bg: 'rgba(52,211,153,0.15)', paid_text: '#34d399', paid_border: 'rgba(52,211,153,0.3)', cost_bg: 'rgba(251,191,36,0.15)', cost_text: '#fbbf24', cost_border: 'rgba(251,191,36,0.3)', radius: '10px' } },
        { name: '翠绿森林', desc: '自然清新，翠绿点缀', cfg: { button_bg: 'rgba(5,20,10,0.65)', button_border: 'rgba(34,197,94,0.35)', button_text: '#d1fae5', hover_bg: 'rgba(34,197,94,0.3)', hover_border: '#22c55e', number_color: '#86efac', paid_bg: 'rgba(132,204,22,0.15)', paid_text: '#84cc16', paid_border: 'rgba(132,204,22,0.3)', cost_bg: 'rgba(250,204,21,0.15)', cost_text: '#facc15', cost_border: 'rgba(250,204,21,0.3)', radius: '8px' } },
        { name: '琥珀金辉', desc: '温暖奢华，金色光芒', cfg: { button_bg: 'rgba(25,15,5,0.7)', button_border: 'rgba(245,158,11,0.4)', button_text: '#fef3c7', hover_bg: 'rgba(245,158,11,0.3)', hover_border: '#f59e0b', number_color: '#fcd34d', paid_bg: 'rgba(132,204,22,0.15)', paid_text: '#84cc16', paid_border: 'rgba(132,204,22,0.3)', cost_bg: 'rgba(251,191,36,0.2)', cost_text: '#fbbf24', cost_border: 'rgba(251,191,36,0.4)', radius: '8px' } },
        { name: '深海蓝', desc: '沉静深邃，海洋蓝调', cfg: { button_bg: 'rgba(0,15,30,0.65)', button_border: 'rgba(59,130,246,0.35)', button_text: '#dbeafe', hover_bg: 'rgba(59,130,246,0.3)', hover_border: '#3b82f6', number_color: '#93c5fd', paid_bg: 'rgba(74,222,128,0.15)', paid_text: '#4ade80', paid_border: 'rgba(74,222,128,0.3)', cost_bg: 'rgba(251,191,36,0.15)', cost_text: '#fbbf24', cost_border: 'rgba(251,191,36,0.3)', radius: '8px' } },
        { name: '玫瑰红', desc: '热烈浪漫，玫瑰色调', cfg: { button_bg: 'rgba(30,5,10,0.65)', button_border: 'rgba(244,63,94,0.35)', button_text: '#fecdd3', hover_bg: 'rgba(244,63,94,0.3)', hover_border: '#f43f5e', number_color: '#fda4af', paid_bg: 'rgba(74,222,128,0.15)', paid_text: '#4ade80', paid_border: 'rgba(74,222,128,0.3)', cost_bg: 'rgba(251,191,36,0.15)', cost_text: '#fbbf24', cost_border: 'rgba(251,191,36,0.3)', radius: '8px' } },
        { name: '暗夜青', desc: '清冷幽静，青色微光', cfg: { button_bg: 'rgba(0,20,25,0.65)', button_border: 'rgba(20,184,166,0.35)', button_text: '#ccfbf1', hover_bg: 'rgba(20,184,166,0.3)', hover_border: '#14b8a6', number_color: '#5eead4', paid_bg: 'rgba(74,222,128,0.15)', paid_text: '#4ade80', paid_border: 'rgba(74,222,128,0.3)', cost_bg: 'rgba(251,191,36,0.15)', cost_text: '#fbbf24', cost_border: 'rgba(251,191,36,0.3)', radius: '8px' } },
        { name: '极简白', desc: '浅色主题，简约明亮', cfg: { button_bg: 'rgba(255,255,255,0.92)', button_border: 'rgba(0,0,0,0.1)', button_text: '#1f2937', hover_bg: 'rgba(99,102,241,0.1)', hover_border: '#6366f1', number_color: '#6b7280', paid_bg: 'rgba(5,150,105,0.12)', paid_text: '#059669', paid_border: 'rgba(5,150,105,0.25)', cost_bg: 'rgba(217,119,6,0.12)', cost_text: '#d97706', cost_border: 'rgba(217,119,6,0.25)', radius: '8px' } }
      ];
      for (let i = 0; i < presetThemes.length; i++) {
        const th = presetThemes[i];
        await conn.query(
          'INSERT INTO choice_themes (name, description, style_config, is_preset, sort_order) VALUES (?, ?, ?, 1, ?)',
          [th.name, th.desc, JSON.stringify(th.cfg), i]
        );
      }
      console.log('[InitDB] 预设选项主题已插入 (' + presetThemes.length + '个)');
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
