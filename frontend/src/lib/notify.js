import { supabase } from './supabase'

/**
 * 로컬에서 실제 수신까지 확인해야 할 때만 켠다 (frontend/.env 에 VITE_PUSH_FORCE_SEND=true).
 * 켜면 실사용자에게 진짜 푸시가 나가므로 확인 후 반드시 되돌릴 것.
 * 서버는 이 값을 비운영 Origin 요청에서만 인정하므로 운영 동작은 바뀌지 않는다.
 */
const FORCE_SEND = import.meta.env.VITE_PUSH_FORCE_SEND === 'true'

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
 * 운영 도메인이 아닌 곳(로컬·preview·LAN)에서 호출하면 서버가 발송을 건너뛰고
 * 문구만 돌려준다. 그 결과를 콘솔에 풀어서 보여준다.
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
      body: { scheduleId, actionType, oldData, forceSend: FORCE_SEND },
      headers: { Authorization: 'Bearer ' + accessToken },
    })

    if (error) {
      console.warn('알림 발송 실패(일정은 정상 저장됨):', error.message)
      return
    }
    if (data?.dryRun) {
      console.log(
        `%c[알림 DRY-RUN] 실제 발송하지 않음 — 대상이었던 기기 ${data.wouldSend}건`,
        'color:#b45309;font-weight:bold',
      )
      console.log('  제목:', data.payload?.title)
      console.log('  본문:', data.payload?.body)
      console.log('  페이로드:', data.payload)
      return
    }
    if (data) {
      console.log('알림 발송 결과:', data)
    }
  } catch (err) {
    console.warn('알림 발송 중 오류(일정은 정상 저장됨):', err)
  }
}
