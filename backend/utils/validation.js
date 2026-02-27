'use strict'

const VALID_ACTION_TYPES = ['CREATED', 'UPDATED', 'DELETED']

/**
 * POST /api/notify 요청 바디 검증
 * @param {object} body - 요청 바디
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateNotifyRequest(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['요청 바디가 유효하지 않습니다.'] }
  }

  const { scheduleId, actionType, actorUserId } = body

  if (!scheduleId) {
    errors.push('scheduleId는 필수입니다.')
  } else if (typeof scheduleId !== 'string' && typeof scheduleId !== 'number') {
    errors.push('scheduleId 형식이 올바르지 않습니다.')
  }

  if (!actionType) {
    errors.push('actionType은 필수입니다.')
  } else if (!VALID_ACTION_TYPES.includes(actionType)) {
    errors.push(`actionType은 ${VALID_ACTION_TYPES.join(', ')} 중 하나여야 합니다.`)
  }

  if (!actorUserId) {
    errors.push('actorUserId는 필수입니다.')
  } else if (typeof actorUserId !== 'string' && typeof actorUserId !== 'number') {
    errors.push('actorUserId 형식이 올바르지 않습니다.')
  }

  return { valid: errors.length === 0, errors }
}

module.exports = { validateNotifyRequest }
