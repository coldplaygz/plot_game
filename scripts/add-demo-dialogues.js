const pool = require('C:/plot_game/config/db');
(async () => {
  const [scenes] = await pool.query('SELECT id, title FROM scenes ORDER BY id ASC LIMIT 3');
  console.log('scenes:', scenes.map(s => `${s.id}:${s.title}`).join(' | '));
  if (!scenes.length) { console.log('无场景'); process.exit(0); }
  const sid = scenes[0].id;

  const [exist] = await pool.query('SELECT COUNT(*) c FROM dialogues WHERE scene_id = ?', [sid]);
  if (exist[0].c > 0) { console.log(`场景#${sid} 已有 ${exist[0].c} 条对白，跳过`); process.exit(0); }

  // 根对白1: 普通对白 3s（两条 line）
  const [d1] = await pool.query(
    "INSERT INTO dialogues (scene_id, parent_id, node_type, speaker, text, text_i18n, show_time, duration, sort_order) VALUES (?, NULL, 'line', ?, ?, ?, 3, 0, 1)",
    [sid, '林小雨', '早啊…你今天来得挺早。',
     JSON.stringify({ en: 'Morning... You are here early today.', ja: 'おはよう…今日は早いね。', ko: '좋은 아침… 오늘 일찍 왔네.' })]
  );
  await pool.query(
    "INSERT INTO dialogues (scene_id, parent_id, node_type, speaker, text, text_i18n, show_time, duration, sort_order) VALUES (?, ?, 'line', ?, ?, ?, 0, 0, 2)",
    [sid, d1.insertId, '林小雨', '昨晚的剧本看完了吗？我总觉得第二幕有点问题。',
     JSON.stringify({ en: 'Did you finish the script? Act two feels off.', ja: '昨日の台本読んだ？第二幕がちょっと変なの。', ko: '어제 대본 읽었어? 2막이 좀 이상한 것 같아.' })]
  );

  // 根对白2: 对白选项 12s
  const [d2] = await pool.query(
    "INSERT INTO dialogues (scene_id, parent_id, node_type, speaker, text, text_i18n, show_time, duration, sort_order) VALUES (?, NULL, 'option', ?, ?, ?, 12, 0, 3)",
    [sid, '林小雨', '周末有空吗？想请你帮我看片子。',
     JSON.stringify({ en: 'Free this weekend? I need your opinion.', ja: '週末暇？映画見てほしいんだけど。', ko: '주말에 시간 있어? 영화 좀 봐줘.' })]
  );
  // 候选项A + 后续
  const [o1] = await pool.query(
    "INSERT INTO dialogues (scene_id, parent_id, node_type, speaker, text, text_i18n, show_time, duration, sort_order) VALUES (?, ?, 'line', NULL, ?, ?, 0, 0, 1)",
    [sid, d2.insertId, '有空，随时都可以', JSON.stringify({ en: 'Sure, anytime.', ja: 'いいよ、いつでも。', ko: '응, 언제든지.' })]
  );
  await pool.query(
    "INSERT INTO dialogues (scene_id, parent_id, node_type, speaker, text, show_time, duration, sort_order) VALUES (?, ?, 'line', ?, ?, 0, 0, 1)",
    [sid, o1.insertId, '林小雨', '太好了！那周六下午，老地方见 ☕']
  );
  // 候选项B + 后续
  const [o2] = await pool.query(
    "INSERT INTO dialogues (scene_id, parent_id, node_type, speaker, text, text_i18n, show_time, duration, sort_order) VALUES (?, ?, 'line', NULL, ?, ?, 0, 0, 2)",
    [sid, d2.insertId, '这周末可能不行，下周吧', JSON.stringify({ en: 'This weekend is tough... next week?', ja: '今週末はちょっと…来週は？', ko: '이번 주말은 좀… 다음 주는 어때?' })]
  );
  await pool.query(
    "INSERT INTO dialogues (scene_id, parent_id, node_type, speaker, text, show_time, duration, sort_order) VALUES (?, ?, 'line', ?, ?, 0, 0, 1)",
    [sid, o2.insertId, '林小雨', '嗯…好吧，那就下周，别忘了哦。']
  );

  console.log(`已插入场景#${sid} 示例对白（普通对白 x2 + 对白选项 x1 含两个分支）`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
