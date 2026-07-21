const http = require('http');
const fs = require('fs');
const path = require('path');

const loginData = JSON.stringify({username:'admin',password:'admin123'});

function getToken() {
  return new Promise((resolve) => {
    const req = http.request({hostname:'localhost',port:3000,path:'/api/auth/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':loginData.length}}, res => {
      let body=''; res.on('data',c=>body+=c);
      res.on('end',()=>resolve(JSON.parse(body).token));
    });
    req.write(loginData); req.end();
  });
}

function uploadFile(token, videoId, type, filePath, language, label, isDefault) {
  return new Promise((resolve) => {
    const boundary = '----Boundary' + Math.random().toString(36).slice(2);
    const filename = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    const headParts = [];
    for (const [k, v] of [['language',language],['label',label],['is_default',isDefault?'1':'0']]) {
      headParts.push(Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="' + k + '"\r\n\r\n' + v + '\r\n', 'utf8'));
    }
    headParts.push(Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + filename + '"\r\nContent-Type: application/octet-stream\r\n\r\n', 'utf8'));
    
    const body = Buffer.concat([Buffer.concat(headParts), fileContent, Buffer.from('\r\n--' + boundary + '--\r\n', 'utf8')]);
    const url = '/api/media/' + videoId + '/' + (type==='audio'?'audios':'subtitles');
    
    const req = http.request({hostname:'localhost',port:3000,path:url,method:'POST',headers:{
      'Authorization':'Bearer '+token,'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':body.length
    }}, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve(JSON.parse(d))}catch(e){resolve({error:d})} });
    });
    req.write(body); req.end();
  });
}

async function main() {
  const token = await getToken();
  
  const cfg = [
    ['zh','中文配音','zh','中文字幕'],
    ['en','English Dub','en','English Subs'],
    ['ja','日本語吹替','ja','日本語字幕'],
  ];
  
  for (let vid = 1; vid <= 4; vid++) {
    console.log('=== 场景' + vid + ' ===');
    for (const [aLang, aLabel, sLang, sLabel] of cfg) {
      const isDef = aLang === 'zh';
      
      const af = '/tmp/scene' + vid + '_' + aLang + '.mp3';
      if (fs.existsSync(af)) {
        const r = await uploadFile(token, vid, 'audio', af, aLang, aLabel, isDef);
        console.log('  音轨 ' + aLabel + ': ' + (r.message||r.error));
      }
      
      const sf = '/tmp/scene' + vid + '_' + sLang + '.vtt';
      if (fs.existsSync(sf)) {
        const r = await uploadFile(token, vid, 'subtitle', sf, sLang, sLabel, isDef);
        console.log('  字幕 ' + sLabel + ': ' + (r.message||r.error));
      }
    }
  }
  console.log('\n完成! 打开游戏客户端可看到右上角语言选择栏');
}
main().catch(e => console.error(e));
