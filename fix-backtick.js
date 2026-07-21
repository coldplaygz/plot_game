const fs = require('fs');
let c = fs.readFileSync('C:\\plot_game\\public\\admin.html', 'utf8');

// Find all occurrences of "\`;" and replace with "`;"
// The issue: the file has literal backslash + backtick + semicolon
let count = 0;
c = c.replace(/\\`;/g, () => { count++; return '`;'; });

console.log('Fixed', count, 'escaped backticks');
fs.writeFileSync('C:\\plot_game\\public\\admin.html', c);
