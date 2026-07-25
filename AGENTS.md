# AGENTS.md — 心动时刻 FMV 互动影像游戏

## 项目概述

"心动时刻"是一个全动态真人互动影像游戏（FMV Interactive Game）。玩家通过视频播放过程中的分支选择推进剧情，选择会影响各女主角好感度，最终导向不同结局。

| 项目 | 值 |
|------|-----|
| 技术栈 | Node.js + Express + MySQL + vue.js+vite|
| 运行时 | Node.js (server.js) |
| 包管理 | npm (无 lock 文件，直接 dependencies) |
| 数据库 | MariaDB 10.11 (MySQL 协议) |
| 本地 DB | `plot_game` @ 192.168.9.2:3306, root/123456 |
| 生产环境 | Ubuntu 24.04, sp.yy388.xyz:80 → localhost:3002 (Nginx) |
| 生产 DB | `plot_game` @ 127.0.0.1:3306, root |
| 进程管理 | PM2 (`pm2 restart plot-game --update-env`) |
| 版本控制 | Git (TortoiseGit) |

## 目录结构

```
C:\plot_game\
├── server.js              # Express 入口，路由挂载，静态文件，全局错误处理
├── package.json           # 依赖声明，scripts
├── .env                   # 本地环境变量（不入 git）
├── .gitignore             # 忽略 node_modules, uploads/videos/*, .env, *.pem
├── nginx-plot-game.conf   # 生产 Nginx 配置（不入 git）
├── deploy-init.js         # 远程环境初始化脚本
├── reset-demo.js          # Demo 数据重建脚本（调用 API）
├── upload-media.js        # 音轨/字幕批量上传脚本
├── fix-backtick.js        # 一次性修复脚本
├── config/
│   ├── db.js              # mysql2/promise 连接池，utf8mb4
│   └── init-db.js         # 自动建库建表 + 种子数据（启动时调用）
├── middleware/
│   └── auth.js            # JWT 认证 (authenticate) + 角色鉴权 (authorize)
├── routes/
│   ├── auth.js            # /api/auth      登录/注册
│   ├── characters.js      # /api/characters 角色 CRUD
│   ├── scenes.js          # /api/scenes    场景管理
│   ├── choices.js         # /api/choices   选项管理
│   ├── endings.js         # /api/endings   结局管理
│   ├── videos.js          # /api/videos    视频上传/管理 (multer)
│   ├── saves.js           # /api/saves     存档读档
│   ├── play.js            # /api/play      游戏核心播放 API
│   └── media.js           # /api/media     音轨/字幕多语言管理
├── public/
│   ├── index.html         # 游戏客户端 SPA（~744 行）
│   └── admin.html         # 管理后台 SPA（~801 行）
├── uploads/
│   ├── videos/            # 视频文件（不入 git）
│   └── media/             # 音轨 (.mp3) + 字幕 (.vtt)
└── test_videos/           # 测试用视频（不入 git）
```

## 数据库架构（13 张表）

```
users             # 用户 (username, password_hash, role: admin/editor/player)
characters        # 女主角 (name, color, personality, avatar, sort_order)
endings           # 结局 (title, type: perfect/good/normal/bad/hidden, character_id)
videos            # 视频素材 (filename, file_path, duration, file_size, mime_type)
scenes            # 剧情场景 (video_id, title, chapter, is_start, is_ending, ending_id, choice_timer)
choices           # 分支选项 (scene_id, text, next_scene_id, timer_seconds)
affection_rules   # 好感度规则 (choice_id, character_id, delta)
conditions        # 解锁条件 (target_type/ID, character_id, operator, value)
saves             # 存档 (user_id, slot 1-9, scene_id, title, play_time)
save_affection    # 存档好感度快照 (save_id, character_id, value)
player_endings    # 玩家结局收集 (user_id, ending_id)
video_audios      # 视频多语言音轨 (video_id, lang, file_path)
video_subtitles   # 视频多语言字幕 (video_id, lang, file_path)
```

所有表使用 InnoDB，字符集 utf8mb4，外键级联删除。

## 关键技术约定

### 1. UTF-8 编码三板斧

```js
// ① 连接池 charset
pool = mysql.createPool({ charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' });
pool.on('connection', conn => conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"));

// ② multer 文件名转码（处理中文乱码）
const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');

// ③ Express 响应头
res.setHeader('Content-Type', 'application/json; charset=utf-8');
```

### 2. choice_delay 和 choice_timer 的默认值语义

- `scenes.choice_delay = 0` → 自动取关联视频的 `duration`（选项在视频结束时弹出）
- `scenes.choice_delay > 0` → 在视频播放到第 N 秒时弹出选项
- `scenes.choice_timer = 0` → 不限时（默认）
- `scenes.choice_timer > 0` → 倒计时 N 秒
- `choices.timer_seconds = 0` → 使用场景默认倒计时

### 3. JS 默认值陷阱

```js
// 错误：x || 10 会吞掉 0（因为 0 是 falsy）
// 正确：
const val = isNaN(parseInt(x)) ? 10 : parseInt(x);
// 或
const val = x ?? 10;  // nullish coalescing，不会吞 0
```

### 4. Video 元素在隐藏容器中的 bug

隐藏容器（`display:none`）中的 `<video>` 元素设置 `src` 会触发浏览器导航到原始视频页。修复：先 `display:block`，再 `requestAnimationFrame(() => video.src = url)`。

### 5. 视频上传

- multer 配置 `limits.fileSize`，用 MB 不是字节
- Nginx 需 `client_max_body_size 500M;`
- 文件名格式：`${timestamp}-${random}.mp4`（fingerprint 命名）
- 存储路径：`uploads/videos/`

### 6. ffprobe 路径

- 本地 Windows：`@ffmpeg-installer/ffmpeg` 自带
- 生产 Ubuntu：`/usr/bin/ffprobe`（需 `apt install ffmpeg`）
- 包 `@ffmpeg-installer/ffmpeg` 不含 ffprobe，需系统安装

### 7. 服务绑定

- 始终绑定 `0.0.0.0` 而不是 `localhost`
- 生产端口 3002，Nginx 代理到 80

### 8. 部署流程

```bash
# 1. 上传文件
scp -i alxg1.pem server.js routes/*.js public/*.html \
  root@47.238.106.118:/var/www/html/plot_game/

# 2. 上传 .env（必须用 scp，不能用 ssh heredoc——密码特殊字符会被 bash 过滤）
scp -i alxg1.pem .env.prod root@47.238.106.118:/var/www/html/plot_game/.env

# 3. 重启
ssh -i alxg1.pem root@47.238.106.118 \
  "cd /var/www/html/plot_game && pm2 restart plot-game --update-env"

# 4. 验证
curl -s http://sp.yy388.xyz/api/health
```

### 9. .env 文件 sed 替换陷阱

```bash
# 精确匹配，避免误改 DB_PORT 之类的变量
sed -i 's/^PORT=.*/PORT=3002/' .env    # ✓ 只匹配行首 PORT=
sed -i 's/PORT=.*/PORT=3002/' .env     # ✗ 可能匹配 DB_PORT
```

## 认证与授权

- JWT Bearer Token，secret 在 `.env`
- 三个角色：`admin`（全部权限）、`editor`（内容管理）、`player`（仅游戏）
- 中间件：`authenticate`（验证 token）+ `authorize(roles)`（角色校验）
- 游戏 API (`/api/play/*`) 全部需要认证

## 前端架构

两个 SPA 页面：
- `public/index.html` — 游戏客户端：视频播放器 + 选项弹窗 + 好感度面板 + 存档系统
- `public/admin.html` — 管理后台：视频管理、场景编排、选项配置、好感度规则、结局管理

纯原生 JavaScript（无框架），直接操作 DOM。

## 踩过的坑

1. **multer 中文文件名乱码** → latin1→utf8 转码
2. **`x || 10` 吞 0** → `??` 或 `isNaN` 检查
3. **隐藏 video 设 src 导航到原始视频** → 先显示再设 src
4. **`@ffmpeg-installer/ffmpeg` 没有 ffprobe** → 生产用系统 ffmpeg
5. **ssh heredoc 传 .env 密码截断** → 改用 scp
6. **sed 误改 DB_PORT** → 用 `^PORT=` 行首精确匹配
7. **PM2 `restart` 不读新 .env** → 加 `--update-env`
8. **端口冲突 zombie 进程** → `fuser -k 3002/tcp` 清理
9. **MariaDB socket 连接失败** → 检查 `bind-address=127.0.0.1`

## 编码规范

- Node.js 代码：CommonJS (`require`/`module.exports`)，不用 ES module
- API 响应统一格式：`{ error: 'message' }` 或 `{ ...data }`
- 数据库查询：全部参数化（`pool.query(sql, [params])`），禁止拼接 SQL
- 文件名：小写 + 连字符，如 `deploy-init.js`
- 前端：内联 CSS/JS，全部在一个 HTML 文件里
- 注释用中文，日志前缀 `[模块名]`

## 命令速查

```bash
# 本地开发
npm run dev          # node --watch server.js（自动重启）
npm start            # 直接启动

# 数据库初始化（已有库跳过不重复创建）
npm run init-db

# 生产运维
pm2 restart plot-game --update-env
pm2 logs plot-game
pm2 status

# 清理端口
fuser -k 3002/tcp

# 健康检查
curl http://localhost:3000/api/health
```

## 安全注意事项

- `.env` 和 `.env.prod` 不入 git
- `.pem` 密钥文件不入 git
- 生产环境修改默认 admin 密码
- JWT_SECRET 使用随机字符串

## 2. 必须遵守（Do）
- 样式Tailwind，禁止内联style

## 3. 绝对禁止（Don't）
- 硬编码颜色、尺寸
- 组件内部直接调用接口
- 遗留无效console.log
- 未经确认安装/删除依赖
- 自动执行破坏性命令
