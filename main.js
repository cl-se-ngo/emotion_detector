import * as faceapi from 'face-api.js'

const video = document.getElementById('video')
const overlay = document.getElementById('overlay')
const status = document.getElementById('status')

const MODELS_URL = `${import.meta.env.BASE_URL}models`

const EMOTIONS = [
  { key: 'happy',     emoji: '😄', color: '#f9e54a' },
  { key: 'sad',       emoji: '😢', color: '#6ab0f5' },
  { key: 'angry',     emoji: '😠', color: '#f56a6a' },
  { key: 'surprised', emoji: '😲', color: '#f5a96a' },
  { key: 'fearful',   emoji: '😨', color: '#b06af5' },
  { key: 'disgusted', emoji: '🤢', color: '#6af5a9' },
  { key: 'neutral',   emoji: '😐', color: '#aaaaaa' },
]

async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
  ])
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })
  video.srcObject = stream
  await new Promise(resolve => { video.onloadedmetadata = resolve })
  video.play()
}

function syncOverlay() {
  overlay.width = overlay.offsetWidth
  overlay.height = overlay.offsetHeight
}

// Returns scale/offset that matches the video's object-fit:cover transform
function getTransform() {
  const dW = overlay.width
  const dH = overlay.height
  const vW = video.videoWidth
  const vH = video.videoHeight
  const scale = Math.max(dW / vW, dH / vH)
  const offsetX = (dW - vW * scale) / 2
  const offsetY = (dH - vH * scale) / 2
  return { scale, offsetX, offsetY, dW }
}

// Convert video coords to canvas coords, with x-flip to match mirrored video
function toCanvas(vx, vy, t) {
  return {
    x: t.dW - (vx * t.scale + t.offsetX),
    y: vy * t.scale + t.offsetY,
  }
}

function drawFaceCircle(ctx, box, color, t) {
  const center = toCanvas(box.x + box.width / 2, box.y + box.height / 2, t)
  const rx = (box.width / 2 + 10) * t.scale
  const ry = (box.height / 2 + 16) * t.scale

  ctx.beginPath()
  ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawDominantEmoji(ctx, box, emoji, t) {
  const pos = toCanvas(box.x + box.width / 2, box.y, t)
  ctx.font = `${52 * t.scale}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(emoji, pos.x, pos.y - 8 * t.scale)
}

function drawEmotionBars(ctx, expressions) {
  const W = overlay.width
  const H = overlay.height
  const barW = 120
  const barH = 6
  const rowH = 26
  const padX = 16
  const padY = 16
  const startY = H - padY - EMOTIONS.length * rowH

  // background pill
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.roundRect(padX - 8, startY - 8, barW + 48, EMOTIONS.length * rowH + 16, 12)
  ctx.fill()

  EMOTIONS.forEach(({ key, emoji, color }, i) => {
    const pct = expressions[key] ?? 0
    const y = startY + i * rowH

    // emoji label
    ctx.font = '16px serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, padX, y + rowH / 2)

    // bar track
    const bx = padX + 26
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.beginPath()
    ctx.roundRect(bx, y + rowH / 2 - barH / 2, barW, barH, 3)
    ctx.fill()

    // bar fill
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(bx, y + rowH / 2 - barH / 2, barW * pct, barH, 3)
    ctx.fill()
  })
}

async function detect() {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 })
  const result = await faceapi.detectSingleFace(video, options).withFaceExpressions()

  syncOverlay()
  const ctx = overlay.getContext('2d')
  ctx.clearRect(0, 0, overlay.width, overlay.height)

  drawEmotionBars(ctx, result ? result.expressions : {})

  if (result) {
    const t = getTransform()
    const dominant = EMOTIONS.reduce((best, e) =>
      (result.expressions[e.key] ?? 0) > (result.expressions[best.key] ?? 0) ? e : best
    )
  }

  requestAnimationFrame(detect)
}

async function main() {
  try {
    status.textContent = 'Loading...'
    await loadModels()
    status.textContent = 'Starting camera...'
    await startCamera()
    syncOverlay()
    status.classList.add('hidden')
    detect()
  } catch (err) {
    status.textContent = `Error: ${err.message}`
    console.error(err)
  }
}

main()
