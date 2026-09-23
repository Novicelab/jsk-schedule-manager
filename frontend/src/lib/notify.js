import { supabase } from './supabase'

/**
 * 일정 변경을 다른 사용자에게 웹 푸시로 알린다.
 *
 * 설계 의도: 알림은 일정 저장의 부수 효과이지 전제 조건이 아니다.
 * 따라서 실패해도 예외를 던지지 않고 콘솔에만 남긴다.
 * (발송 실패 이력은 서버의 notifications 테이블에 기록된다)
 *
 * 작성자 본인 제외는 서버가 JWT에서 확정한 사용자 기준으로 처리하므로
 * 여기서 actorUserId 를 보낼 필요가 없다.
 *
 * @param {object}  params
 * @param {number}  params.scheduleId
 * @param {'CREATED'|'UPDATED'|'DELETED'} params.actionType
 * @param {object} [params.oldData] 수정 전 값 (UPDATED일 때 변경 내역 문구 생성용)
 */
export async function notifyScheduleChange({ scheduleId, actionType, oldData }) {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) return

    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { scheduleId, actionType, oldData },
      headers: { Authorization: 'Bearer ' + accessToken },
    })

    if (error) {
      console.warn('알림 발송 실패(일정은 정상 저장됨):', error.message)
      return
    }
    if (data) {
      console.log('알림 발송 결과:', data)
    }
  } catch (err) {
    console.warn('알림 발송 중 오류(일정은 정상 저장됨):', err)
  }
}
