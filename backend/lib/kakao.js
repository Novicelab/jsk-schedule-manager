'use strict'

const axios = require('axios')
const logger = require('../utils/logger')

const KAKAO_MEMO_API_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send'

/**
 * 카카오 나에게 보내기 API 호출
 * @param {string} accessToken - 카카오 사용자 액세스 토큰
 * @param {string} message - 전송할 메시지
 * @returns {Promise<{ success: boolean, statusCode: number, error?: string }>}
 */
async function sendKakaoMessage(accessToken, message) {
  const templateObject = JSON.stringify({
    object_type: 'text',
    text: message,
    link: { web_url: '', mobile_web_url: '' },
  })

  try {
    console.log(`[KAKAO_DEBUG] 요청 시작: ${KAKAO_MEMO_API_URL}`)
    console.log(`[KAKAO_DEBUG] 토큰 길이: ${accessToken?.length}`)

    const response = await axios.post(
      KAKAO_MEMO_API_URL,
      `template_object=${encodeURIComponent(templateObject)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${accessToken}`,
        },
        // 4xx, 5xx에서 throw 하지 않도록 설정 (에러 원인 파악 목적)
        validateStatus: () => true,
      }
    )

    console.log(`[KAKAO_DEBUG] 응답 상태: ${response.status}`)
    console.log(`[KAKAO_DEBUG] 응답 데이터:`, JSON.stringify(response.data))

    if (response.status === 200) {
      console.log('[KAKAO_SUCCESS] 카카오 메시지 발송 성공')
      return { success: true, statusCode: response.status }
    }

    const errorMsg =
      response.data?.msg ||
      response.data?.error_description ||
      response.data?.error ||
      'unknown error'

    logger.warn('카카오 API 오류 응답', {
      status: response.status,
      error: errorMsg,
      fullData: response.data,
    })
    console.log(`[KAKAO_ERROR] 상태: ${response.status}, 메시지: ${errorMsg}`)

    return {
      success: false,
      statusCode: response.status,
      error: `[KAKAO_ERROR ${response.status}] ${errorMsg}`,
    }
  } catch (err) {
    console.error('[KAKAO_EXCEPTION] API 호출 실패:', err.message)
    logger.error('카카오 API 호출 실패', err.message)
    return {
      success: false,
      statusCode: 0,
      error: `[ERROR] ${err.message}`,
    }
  }
}

/**
 * 알림 메시지 텍스트 생성
 * @param {object} schedule - 일정 데이터
 * @param {string} actorName - 액션 수행자 이름
 * @param {string} actionType - 'CREATED' | 'UPDATED' | 'DELETED'
 * @returns {string}
 */
function buildNotificationMessage(schedule, actorName, actionType) {
  const actionLabel =
    actionType === 'CREATED' ? '등록' :
    actionType === 'UPDATED' ? '수정' : '삭제'

  const startDate = new Date(schedule.start_at).toLocaleDateString('ko-KR')
  const endDate = new Date(schedule.end_at).toLocaleDateString('ko-KR')

  let message = `📅 [일정 ${actionLabel}]\n`
  message += `작성자: ${actorName}\n`
  message += `제목: ${schedule.title}\n`
  message += `일자: ${startDate}`

  if (startDate !== endDate) {
    message += ` ~ ${endDate}`
  }

  if (!schedule.all_day) {
    const startTime = new Date(schedule.start_at).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const endTime = new Date(schedule.end_at).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    message += `\n시간: ${startTime} ~ ${endTime}`
  }

  return message
}

module.exports = { sendKakaoMessage, buildNotificationMessage }
