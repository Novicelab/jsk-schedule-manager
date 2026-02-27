'use strict'

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const logger = require('./utils/logger')
const notifyRouter = require('./routes/notify')

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)

// CORS 설정
const rawOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:5173'
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // 서버 간 요청(origin 없음)은 허용
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS 정책에 의해 차단된 오리진: ${origin}`))
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
)

app.use(express.json())

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 알림 라우터
app.use('/api/notify', notifyRouter)

// 404 핸들러
app.use((_req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' })
})

// 전역 에러 핸들러
app.use((err, _req, res, _next) => {
  logger.error('서버 에러', err.message)
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' })
})

app.listen(PORT, () => {
  logger.info(`JSK 알림 백엔드 서버 시작 (포트: ${PORT})`)
  logger.info(`허용된 오리진: ${allowedOrigins.join(', ')}`)
})
