// 一次性修复脚本 — 修复 admin.html 中的转义反引号
// 注意：此脚本已归档，原 public/admin.html 已迁移到 Vue
const fs = require('fs');
let c = fs.readFileSync('C:\\plot_game\\public\\admin.html', 'utf8');

let count = 0;
c = c.replace(/\\`;/g, () => { count++; return '`;'; });

console.log('Fixed', count, 'escaped backticks');
fs.writeFileSync('C:\\plot_game\\public\\admin.html', c);
