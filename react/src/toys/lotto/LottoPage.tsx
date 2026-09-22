import DevPanel from './DevPanel.tsx'
import LottoSettings from './LottoSettings.tsx'

// 개발 서버에서만 화면을 보여 준다. 프로덕션은 기존 "준비 중" 그대로.
// DevPanel은 설정 화면(LottoSettings) 아래에 구분선과 함께 당분간 유지하고, Phase 5b에서 제거한다.
export default function LottoPage() {
  if (!import.meta.env.DEV) return <p>준비 중입니다.</p>
  return (
    <div>
      <LottoSettings />
      <hr />
      <DevPanel />
    </div>
  )
}
