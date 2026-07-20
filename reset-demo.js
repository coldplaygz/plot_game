/**
 * 清除旧乱码数据，重建完整 Demo
 * 直接用 Node.js 写入，确保 UTF-8 正确
 */
const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3000;
let TOKEN = '';

function api(method, path, data, isFormData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST, port: API_PORT, path: path, method: method,
      headers: {}
    };
    if (TOKEN) options.headers['Authorization'] = 'Bearer ' + TOKEN;

    if (isFormData) {
      // multipart handled separately
      resolve(null);
      return;
    }

    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json; charset=utf-8';
      options.headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch(e) { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function uploadFile(path, fieldName, filePath, extraFields) {
  const fs = require('fs');
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  
  const parts = [];
  for (const [k, v] of Object.entries(extraFields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    );
  }
  
  const filename = filePath.split('/').pop().split('\\').pop();
  const fileContent = fs.readFileSync(filePath);
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: video/mp4\r\n\r\n`
  );
  
  const head = Buffer.concat(parts.map(p => Buffer.from(p, 'utf8')));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([head, fileContent, tail]);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST, port: API_PORT, path: path, method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({raw:data}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // 1. 登录
  console.log('[1] 登录...');
  const login = await api('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  TOKEN = login.token;
  console.log('   TOKEN:', TOKEN ? 'OK' : 'FAILED');

  // 2. 清除旧数据（从依赖表开始）
  console.log('[2] 清除旧数据...');
  // 简单粗暴：删表重建
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: '192.168.9.2', user: 'root', password: '123456',
    database: 'plot_game', charset: 'utf8mb4'
  });
  await conn.query('SET NAMES utf8mb4');
  await conn.query('DELETE FROM save_affection');
  await conn.query('DELETE FROM saves');
  await conn.query('DELETE FROM player_endings');
  await conn.query('DELETE FROM affection_rules');
  await conn.query('DELETE FROM conditions');
  await conn.query('DELETE FROM choices');
  await conn.query('DELETE FROM scenes');
  await conn.query('DELETE FROM videos');
  await conn.query('DELETE FROM endings');
  // characters 保留（init-db时已创建）
  await conn.query('ALTER TABLE characters AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE videos AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE scenes AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE choices AUTO_INCREMENT = 1');
  await conn.query('ALTER TABLE endings AUTO_INCREMENT = 1');
  console.log('   旧数据已清除');

  // Re-create characters (in case they were deleted)
  const [chars] = await conn.query('SELECT COUNT(*) as cnt FROM characters');
  if (chars[0].cnt === 0) {
    const ch = [
      ['林雨晴', '#ff6b9d', '温柔体贴的邻家女孩', '温柔/善良/害羞'],
      ['苏若雪', '#7c3aed', '冷艳高傲的公司总裁', '高冷/强势/优雅'],
      ['赵小曼', '#f59e0b', '活泼开朗的运动系学妹', '阳光/开朗/直率'],
      ['陈思涵', '#06b6d4', '神秘莫测的转校生', '神秘/聪慧/冷静'],
      ['周雅琪', '#ec4899', '知性优雅的咖啡店老板娘', '成熟/知性/温柔'],
      ['沈月', '#10b981', '古灵精怪的童年玩伴', '活泼/叛逆/勇敢']
    ];
    for (const c of ch) {
      await conn.query('INSERT INTO characters (name,color,description,personality,sort_order) VALUES (?,?,?,?,?)', [...c, ch.indexOf(c)+1]);
    }
    console.log('   角色已重建');
  }
  await conn.end();

  // 3. 创建结局
  console.log('[3] 创建结局...');
  const e1 = await api('POST', '/api/endings', { title: '图书馆的约定', description: '和林雨晴在图书馆共度安静的午后，两颗心慢慢靠近...', type: 'good', character_id: 1 });
  const e2 = await api('POST', '/api/endings', { title: '操场上的心跳', description: '赵小曼的笑声回荡在操场上，青春的汗水与心动交织。', type: 'normal', character_id: 3 });
  const e3 = await api('POST', '/api/endings', { title: '咖啡馆的偶遇', description: '苏若雪对你露出了难得一见的微笑，冰山融化了。', type: 'perfect', character_id: 2 });
  console.log('   E1=', e1.ending.id, 'E2=', e2.ending.id, 'E3=', e3.ending.id);

  // 4. 上传视频
  console.log('[4] 上传视频...');
  const baseDir = 'C:\\plot_game\\test_videos';
  const videos = [
    ['scene1_intro.mp4', '序章-新校园的第一天'],
    ['scene2_library.mp4', '林雨晴-图书馆'],
    ['scene3_playground.mp4', '赵小曼-操场'],
    ['scene4_cafe.mp4', '苏若雪-咖啡馆'],
    ['ending_good.mp4', '结局-图书馆的约定'],
    ['ending_normal.mp4', '结局-操场上的心跳'],
    ['ending_perfect.mp4', '结局-咖啡馆的偶遇'],
  ];
  const vids = {};
  for (const [fname, title] of videos) {
    const r = await uploadFile('/api/videos', 'video', `${baseDir}/${fname}`, { title });
    if (r.video) {
      vids[fname] = r.video.id;
      console.log('   ', title, '→ id=', r.video.id);
    } else {
      console.log('   ', title, '→ FAILED:', JSON.stringify(r).slice(0,100));
    }
  }

  // 5. 创建场景
  console.log('[5] 创建场景...');
  console.log('   vids keys:', Object.keys(vids).join(', '));
  console.log('   vids values:', JSON.stringify(vids));
  const scenes = [
    { video_id: vids['scene1_intro.mp4'], title: '新校园的第一天', chapter: '序章', description: '主角来到新校园...', is_start: true, choice_timer: 10, choice_delay: 3 },
    { video_id: vids['scene2_library.mp4'], title: '安静的图书馆', chapter: '林雨晴线', choice_timer: 8, choice_delay: 0 },
    { video_id: vids['scene3_playground.mp4'], title: '热闹的操场', chapter: '赵小曼线', choice_timer: 8, choice_delay: 0 },
    { video_id: vids['scene4_cafe.mp4'], title: '温馨的咖啡馆', chapter: '苏若雪线', choice_timer: 8, choice_delay: 0 },
    { video_id: vids['ending_good.mp4'], title: '图书馆的约定', chapter: '结局', is_ending: true, ending_id: e1.ending.id, choice_timer: 0, choice_delay: 0 },
    { video_id: vids['ending_normal.mp4'], title: '操场上的心跳', chapter: '结局', is_ending: true, ending_id: e2.ending.id, choice_timer: 0, choice_delay: 0 },
    { video_id: vids['ending_perfect.mp4'], title: '咖啡馆的偶遇', chapter: '结局', is_ending: true, ending_id: e3.ending.id, choice_timer: 0, choice_delay: 0 },
  ];
  const sids = [];
  for (const s of scenes) {
    const r = await api('POST', '/api/scenes', s);
    sids.push(r.scene.id);
    console.log('   ', r.scene.title, '→ id=', r.scene.id);
  }

  // 6. 创建选项 + 好感度
  console.log('[6] 创建选项和好感度...');
  const choicesCfg = [
    [sids[0], '和林雨晴去图书馆 (温柔体贴路线)', sids[1], [{ cid: 1, delta: 15 }]],
    [sids[0], '和赵小曼去操场 (活力运动路线)', sids[2], [{ cid: 3, delta: 15 }]],
    [sids[0], '去咖啡馆偶遇苏若雪 (高冷御姐路线)', sids[3], [{ cid: 2, delta: 15 }]],
    [sids[1], '和她一起讨论书中的故事', sids[4], [{ cid: 1, delta: 20 }]],
    [sids[1], '偷偷观察她认真的侧脸', sids[4], [{ cid: 1, delta: 10 }]],
    [sids[2], '全力以赴，和她一决高下', sids[5], [{ cid: 3, delta: 20 }]],
    [sids[2], '故意放水，让她赢', sids[5], [{ cid: 3, delta: 10 }]],
    [sids[3], '主动搭话，聊聊咖啡的品味', sids[6], [{ cid: 2, delta: 20 }]],
    [sids[3], '默默坐在角落观察她', sids[6], [{ cid: 2, delta: 10 }]],
  ];
  for (const [sceneId, text, nextId, affs] of choicesCfg) {
    const r = await api('POST', '/api/choices', { scene_id: sceneId, text, next_scene_id: nextId, sort_order: 0 });
    const cid = r.choice.id;
    if (affs && affs.length > 0) {
      await api('POST', `/api/choices/${cid}/affection`, { rules: affs.map(a => ({ character_id: a.cid, delta: a.delta })) });
    }
    console.log('   ', text.slice(0, 20), '→ scene#', nextId, 'aff:', affs.map(a=>`C${a.cid}:${a.delta>0?'+':''}${a.delta}`).join(','));
  }

  console.log('\n✅ Demo 重建完成! 所有中文数据已按 UTF-8 正确存储');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
