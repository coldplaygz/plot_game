/**
 * 道具粒子动画系统
 * 从 GamePlayer.vue 抽出，负责粒子生成、震屏效果
 */
import { ref } from 'vue'

const PROP_COLORS = ['#ff6b9d', '#7c3aed', '#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#facc15', '#fb923c', '#22d3ee', '#a78bfa']

function rand(min, max) { return min + Math.random() * (max - min) }

export function useParticleSystem(rootEl) {
  const effectAnims = ref([])
  let animSeq = 0
  const effectShake = ref(false)
  let shakeTimer = null

  function triggerShake() {
    effectShake.value = true
    if (shakeTimer) clearTimeout(shakeTimer)
    shakeTimer = setTimeout(() => { effectShake.value = false }, 480)
  }

  function spawnEffect(p) {
    const el = rootEl.value
    const w = el ? el.clientWidth : window.innerWidth
    const h = el ? el.clientHeight : window.innerHeight
    // 每次触发的中心点全屏随机（避免连点时特效都挤在中间）
    const cx = Math.round(w * (0.08 + Math.random() * 0.84))
    const cy = Math.round(h * (0.12 + Math.random() * 0.56))
    const type = p.animation || 'confetti'

    const push = (opts) => {
      const id = ++animSeq
      const arc = opts.arc || 0
      const arcTx = Math.round((opts.tx || 0) * 0.55)
      const arcTy = Math.round((opts.ty || 0) * 0.55 - arc)
      const arcRot = Math.round((opts.rot || 0) * 0.5)
      effectAnims.value.push({
        id,
        x: opts.x, y: opts.y,
        tx: opts.tx || 0, ty: opts.ty || 0,
        rot: opts.rot || 0, scale: opts.scale || 1,
        tx2: Math.round((opts.tx || 0) * 0.92),
        ty2: Math.round((opts.ty || 0) * 0.92),
        rot2: Math.round((opts.rot || 0) * 0.8),
        scale2: (opts.scale || 1) * 1.18,
        arcTx, arcTy, arcRot,
        dur: opts.dur || 1.2, delay: opts.delay || 0,
        endOp: opts.endOp ?? 0, anim: opts.anim || 'fly',
        size: opts.size || 40,
        color: opts.color || '#ffffff',
        icon: opts.icon || p.icon,
        shape: opts.shape || 'emoji'
      })
      const lifeMs = ((opts.dur || 1.2) + (opts.delay || 0)) * 1000 + 300
      setTimeout(() => {
        effectAnims.value = effectAnims.value.filter(a => a.id !== id)
      }, lifeMs)
    }

    const color = PROP_COLORS[Math.floor(Math.random() * PROP_COLORS.length)]

    switch (type) {
      case 'egg':
      case 'tomato': {
        const fromLeft = Math.random() > 0.5
        const startX = fromLeft ? -50 : w + 50
        const startY = h - 40
        const impactX = cx
        const impactY = cy + 100
        const tx = impactX - startX
        const ty = impactY - startY
        const arc = Math.round(h * 0.28)
        const rotDir = fromLeft ? 1 : -1
        push({
          x: startX, y: startY,
          tx, ty, arc,
          rot: rotDir * 720, scale: 1.15,
          dur: 0.72, anim: 'toss', endOp: 0, size: 56
        })
        setTimeout(() => {
          triggerShake()
          if (type === 'egg') {
            for (let i = 0; i < 8; i++) {
              const ang = Math.random() * Math.PI * 2
              const dist = rand(70, 200)
              push({
                x: impactX, y: impactY, tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
                rot: rand(-420, 420), scale: rand(0.6, 1.1),
                dur: rand(0.8, 1.2), delay: rand(0, 0.08),
                size: rand(14, 24),
                color: '#fffdf5', shape: 'shell'
              })
            }
            for (let i = 0; i < 6; i++) {
              const ang = -Math.PI / 2 + rand(-1.2, 1.2)
              const dist = rand(50, 140)
              push({
                x: impactX, y: impactY,
                tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist + rand(40, 90),
                rot: rand(-120, 120), scale: rand(0.7, 1.2),
                dur: rand(0.9, 1.4), delay: rand(0, 0.12),
                size: rand(10, 18),
                color: '#ffca28', shape: 'yolk'
              })
            }
          } else {
            for (let i = 0; i < 10; i++) {
              const ang = Math.random() * Math.PI * 2
              const dist = rand(60, 190)
              push({
                x: impactX, y: impactY, tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
                rot: rand(-360, 360), scale: rand(0.5, 1),
                dur: rand(0.7, 1.1), delay: rand(0, 0.1),
                size: rand(16, 30),
                color: ['#e53935', '#ef5350', '#c62828', '#ff6f60'][i % 4],
                shape: 'flesh'
              })
            }
            for (let i = 0; i < 6; i++) {
              const ang = -Math.PI / 2 + rand(-1.2, 1.2)
              const dist = rand(40, 120)
              push({
                x: impactX, y: impactY,
                tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist + rand(30, 70),
                rot: rand(-100, 100), scale: rand(0.6, 1),
                dur: rand(0.8, 1.2), delay: rand(0, 0.1),
                size: rand(8, 14),
                color: '#ff5252',
                shape: 'flesh'
              })
            }
          }
        }, 660)
        break
      }
      case 'flower':
      case 'heart':
      case 'star': {
        for (let i = 0; i < 14; i++) {
          push({
            x: cx + rand(-50, 50), y: cy + 260,
            tx: rand(-110, 110), ty: -rand(340, 560),
            rot: rand(-80, 80), scale: rand(0.6, 1.25),
            dur: rand(1.5, 2.3), delay: rand(0, 0.3),
            size: rand(28, 58),
            color: type === 'flower' ? PROP_COLORS[i % PROP_COLORS.length] : '#ffffff'
          })
        }
        break
      }
      case 'confetti': {
        for (let i = 0; i < 32; i++) {
          push({
            x: rand(w * 0.05, w * 0.95), y: -20,
            tx: rand(-140, 140), ty: h + 50,
            rot: rand(-720, 720), scale: 1,
            dur: rand(1.6, 2.9), delay: rand(0, 0.45),
            size: 10,
            color: PROP_COLORS[i % PROP_COLORS.length],
            shape: 'confetti'
          })
        }
        break
      }
      case 'firework': {
        triggerShake()
        push({ x: cx, y: cy, tx: 0, ty: 0, scale: 0.35, dur: 0.45, anim: 'pop', endOp: 1, size: 26, color: '#ffffff' })
        setTimeout(() => {
          for (let i = 0; i < 20; i++) {
            const ang = (i / 20) * Math.PI * 2 + rand(-0.07, 0.07)
            const dist = rand(130, 280)
            push({
              x: cx, y: cy,
              tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
              rot: 0, scale: rand(0.5, 1.05),
              dur: rand(0.8, 1.4), delay: 0,
              size: rand(10, 20),
              color: PROP_COLORS[i % PROP_COLORS.length],
              anim: 'spark'
            })
          }
        }, 360)
        break
      }
      case 'coin': {
        triggerShake()
        for (let i = 0; i < 10; i++) {
          push({
            x: cx + rand(-110, 110), y: -40 - i * 45,
            tx: rand(-60, 60), ty: h * 0.5 + rand(0, 160),
            rot: rand(-420, 420), scale: rand(0.8, 1.25),
            dur: rand(1.2, 1.9), delay: rand(0, 0.15),
            size: rand(32, 48),
            color: '#facc15'
          })
        }
        break
      }
      default: {
        for (let i = 0; i < 12; i++) {
          const ang = Math.random() * Math.PI * 2
          const dist = rand(80, 220)
          push({
            x: cx, y: cy,
            tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
            rot: rand(-360, 360), scale: rand(0.6, 1.3),
            dur: rand(1, 1.8), delay: rand(0, 0.2),
            size: rand(24, 50), color
          })
        }
      }
    }
  }

  function cleanup() {
    if (shakeTimer) clearTimeout(shakeTimer)
    effectAnims.value = []
  }

  return { effectAnims, effectShake, triggerShake, spawnEffect, cleanup }
}
