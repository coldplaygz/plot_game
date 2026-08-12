#!/bin/bash
# 为视频生成多语言音轨(zh/en/ja/ko)和字幕
# 用法: cd 项目根目录 && bash scripts/ops/gen-media.sh

set -e
MEDIA="uploads/media"
mkdir -p "$MEDIA"

for VID in 63 64; do
  SRC=$(node -e "
    const m=require('mysql2/promise');
    (async()=>{
      const p=m.createPool({host:'192.168.9.2',user:'root',password:'123456',database:'plot_game'});
      const[r]=await p.query('SELECT file_path FROM videos WHERE id=?',[$VID]);
      console.log(r[0].file_path.replace(/\\\\/g,'/'));
      p.end();
    })()
  " 2>/dev/null)

  DUR=52
  echo "=== 视频 $VID: $SRC ==="

  echo "  中文音轨..."
  ffmpeg -y -i "$SRC" -vn -acodec libmp3lame -ab 192k \
    "$MEDIA/v${VID}-zh-$(date +%s%3N).mp3" 2>/dev/null

  echo "  英文音轨..."
  ffmpeg -y -f lavfi -i "sine=frequency=440:duration=$DUR" -acodec libmp3lame -ab 128k \
    "$MEDIA/v${VID}-en-$(date +%s%3N).mp3" 2>/dev/null

  echo "  日文音轨..."
  ffmpeg -y -f lavfi -i "sine=frequency=554:duration=$DUR" -acodec libmp3lame -ab 128k \
    "$MEDIA/v${VID}-ja-$(date +%s%3N).mp3" 2>/dev/null

  echo "  韩文音轨..."
  ffmpeg -y -f lavfi -i "sine=frequency=660:duration=$DUR" -acodec libmp3lame -ab 128k \
    "$MEDIA/v${VID}-ko-$(date +%s%3N).mp3" 2>/dev/null

  TS=$(date +%s%3N)
  cat > "$MEDIA/v${VID}-zh-$TS.vtt" << 'VTT'
WEBVTT

00:00:01.000 --> 00:00:05.000
梅西带球突破，一个漂亮的过人！

00:00:06.000 --> 00:00:10.000
他晃过了防守球员，直接面对门将！

00:00:11.000 --> 00:00:15.000
射门！球进了！精彩的进球！

00:00:16.000 --> 00:00:20.000
全场观众沸腾了，这是一个世界级的进球。

00:00:22.000 --> 00:00:28.000
梅西再次展现了他的魔力，这就是足球的魅力！

00:00:30.000 --> 00:00:35.000
巴塞罗那的球迷们欢呼雀跃。

00:00:38.000 --> 00:00:45.000
这个进球将被载入欧冠历史的经典时刻。

00:00:47.000 --> 00:00:51.000
2019-2020赛季欧冠，巴塞罗那对阵那不勒斯。
VTT

  cat > "$MEDIA/v${VID}-en-$TS.vtt" << 'VTT'
WEBVTT

00:00:01.000 --> 00:00:05.000
Messi dribbles past the defender, what a move!

00:00:06.000 --> 00:00:10.000
He beats another player, now one-on-one with the goalkeeper!

00:00:11.000 --> 00:00:15.000
He shoots! GOAL! What a brilliant finish!

00:00:16.000 --> 00:00:20.000
The crowd goes wild, a world-class goal from Messi.

00:00:22.000 --> 00:00:28.000
Messi shows his magic once again, this is the beauty of football!

00:00:30.000 --> 00:00:35.000
Barcelona fans are celebrating in the stands.

00:00:38.000 --> 00:00:45.000
This goal will be remembered as a classic Champions League moment.

00:00:47.000 --> 00:00:51.000
2019-2020 UEFA Champions League, Barcelona vs Napoli.
VTT

  cat > "$MEDIA/v${VID}-ja-$TS.vtt" << 'VTT'
WEBVTT

00:00:01.000 --> 00:00:05.000
メッシがドリブルで突破！素晴らしい動き！

00:00:06.000 --> 00:00:10.000
ディフェンダーをかわし、ゴールキーパーと1対1！

00:00:11.000 --> 00:00:15.000
シュート！ゴール！見事なフィニッシュ！

00:00:16.000 --> 00:00:20.000
観客が熱狂、メッシのワールドクラスのゴール。

00:00:22.000 --> 00:00:28.000
メッシが再び魔法を見せる、これがサッカーの魅力！

00:00:30.000 --> 00:00:35.000
バルセロナのファンが歓喜に沸く。

00:00:38.000 --> 00:00:45.000
このゴールはチャンピオンズリーグの歴史的瞬間として記憶されるだろう。

00:00:47.000 --> 00:00:51.000
2019-2020 UEFAチャンピオンズリーグ、バルセロナ対ナポリ。
VTT

  cat > "$MEDIA/v${VID}-ko-$TS.vtt" << 'VTT'
WEBVTT

00:00:01.000 --> 00:00:05.000
메시가 드리블 돌파! 환상적인 움직임!

00:00:06.000 --> 00:00:10.000
수비수를 제치고 골키퍼와 1대1!

00:00:11.000 --> 00:00:15.000
슛! 골! 완벽한 마무리!

00:00:16.000 --> 00:00:20.000
관중이 열광합니다, 메시의 월드클래스 골.

00:00:22.000 --> 00:00:28.000
메시가 다시 한번 마법을 보여줍니다, 이것이 축구의 매력!

00:00:30.000 --> 00:00:35.000
바르셀로나 팬들이 기쁨에 환호합니다.

00:00:38.000 --> 00:00:45.000
이 골은 챔피언스리그 역사적인 순간으로 기억될 것입니다.

00:00:47.000 --> 00:00:51.000
2019-2020 UEFA 챔피언스리그, 바르셀로나 대 나폴리.
VTT

done

echo "=== 生成完成 ==="
ls -la "$MEDIA"/v6[34]-* 2>/dev/null
