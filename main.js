import * as faceapi from 'face-api.js'

const video = document.getElementById('video')
const overlay = document.getElementById('overlay')
const status = document.getElementById('status')
const noFace = document.getElementById('no-face')
const emotionBars = document.getElementById('emotion-bars')

const MODELS_URL = `${import.meta.env.BASE_URL}models`

const EMOTIONS = ['happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral']

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

function resizeOverlay() {
  overlay.width = video.videoWidth
  overlay.height = video.videoHeight
}

function drawFaceBox(ctx, detection) {
  const { x, y, width, height } = detection.detection.box
  // Flip x to match the mirrored video
  const flippedX = overlay.width - x - width

  ctx.strokeStyle = '#7c6af7'
  ctx.lineWidth = 2
  ctx.strokeRect(flippedX, y, width, height)
}

function updateEmotionBars(expressions) {
  const dominant = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b)[0]

  EMOTIONS.forEach(emotion => {
    const row = document.querySelector(`.emotion-row[data-emotion="${emotion}"]`)
    const bar = row.querySelector('.bar')
    const score = row.querySelector('.score')
    const pct = Math.round((expressions[emotion] ?? 0) * 100)

    bar.style.width = `${pct}%`
    score.textContent = `${pct}%`
    row.classList.toggle('dominant', emotion === dominant)
  })
}

async function detect() {
  const ctx = overlay.getContext('2d')
  resizeOverlay()

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })

  const result = await faceapi
    .detectSingleFace(video, options)
    .withFaceExpressions()

  ctx.clearRect(0, 0, overlay.width, overlay.height)

  if (result) {
    drawFaceBox(ctx, result)
    noFace.classList.add('hidden')
    emotionBars.classList.remove('hidden')
    updateEmotionBars(result.expressions)
  } else {
    noFace.classList.remove('hidden')
    emotionBars.classList.add('hidden')
  }

  requestAnimationFrame(detect)
}

async function main() {
  try {
    status.textContent = 'Loading models...'
    await loadModels()

    status.textContent = 'Starting camera...'
    await startCamera()

    status.textContent = 'Ready'
    status.classList.add('ready')

    detect()
  } catch (err) {
    status.textContent = `Error: ${err.message}`
    console.error(err)
  }
}

main()
