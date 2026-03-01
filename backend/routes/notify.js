'use strict'

const express = require('express')
const router = express.Router()
const { supabaseAdmin } = require('../lib/supabase')
const { sendKakaoMessage, buildNotificationMessage } = require('../lib/kakao')
const { validateNotifyRequest } = require('../utils/validation')
const logger = require('../utils/logger')

/**
 * POST /api/notify
 * 일정 CRUD 이벤트 발생 시 카카오 알림 발송
 *
 * Body: { scheduleId: string, actionType: 'CREATED'|'UPDATED'|'DELETED', actorUserId: string }
 */
router.post('/', async (req, res) => {
  const { valid, errors } = validateNotifyRequest(req.body)
  if (!valid) {
    return res.status(400).json({ error: errors.join(' ') })
  }

  const { scheduleId, actionType, actorUserId } = req.body

  logger.info('알림 발송 요청', { scheduleId, actionType, actorUserId })

  try {
    // 1. 일정 정보 조회
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule) {
      logger.error('일정 조회 실패', scheduleError)
      return res.status(404).json({ error: '일정을 찾을 수 없습니다.' })
    }

    // 2. 액션 수행자 이름 조회
    const { data: actor } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', actorUserId)
      .single()

    const actorName = actor?.name || '알 수 없음'

    // 3. 카카오 토큰이 있는 알림 대상 사용자 전체 조회
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, kakao_access_token')
      .not('kakao_access_token', 'is', null)

    if (!users || users.length === 0) {
      logger.info('알림 대상 사용자 없음')
      return res.json({ sent: 0, failed: 0, message: '알림 대상 사용자가 없습니다.' })
    }

    // 4. 알림 설정 일괄 조회 (N+1 쿼리 방지)
    const scheduleType = schedule.type
    const userIds = users.map((u) => u.id)

    const { data: allPrefs = [] } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id, enabled')
      .in('user_id', userIds)
      .eq('schedule_type', scheduleType)
      .eq('action_type', actionType)

    // user_id → enabled 매핑 (O(1) 조회)
    const prefMap = new Map(allPrefs.map((p) => [p.user_id, p.enabled]))

    // 5. 알림 메시지 생성
    const message = buildNotificationMessage(schedule, actorName, actionType)

    let sentCount = 0
    let failedCount = 0
    const failureDetails = []

    // 6. 각 사용자에게 카카오 알림 발송 및 기록
    for (const user of users) {
      // 알림 설정 확인 (설정 없으면 기본값 true)
      const isEnabled = prefMap.get(user.id) !== false
      if (!isEnabled) continue

      const result = await sendKakaoMessage(user.kakao_access_token, message)

      // 알림 기록 저장
      let notifMessage = message
      if (!result.success) {
        // 카카오 API 에러 상세 정보를 message에 포함
        notifMessage = `[KAKAO_ERROR ${result.statusCode}] ${result.error} | 원본: ${message}`
      }

      await supabaseAdmin.from('notifications').insert({
        schedule_id: scheduleId,
        user_id: user.id,
        type: `SCHEDULE_${actionType}`,
        channel: 'KAKAO',
        status: result.success ? 'SUCCESS' : 'FAILED',
        message: notifMessage,
        sent_at: result.success ? new Date().toISOString() : null,
      })

      if (result.success) {
        sentCount++
      } else {
        failedCount++
        failureDetails.push({
          user_id: user.id,
          error: result.error,
          statusCode: result.statusCode,
          fullMessage: notifMessage
        })
        logger.warn('카카오 알림 발송 실패', { userId: user.id, error: result.error, statusCode: result.statusCode })
      }
    }

    logger.info('알림 발송 완료', { sent: sentCount, failed: failedCount, failures: failureDetails })
    return res.json({
      sent: sentCount,
      failed: failedCount,
      failureDetails: failureDetails
    })
  } catch (err) {
    logger.error('알림 처리 중 예외 발생', err.message)
    return res.status(500).json({ error: '알림 처리 중 오류가 발생했습니다.' })
  }
})

module.exports = router
