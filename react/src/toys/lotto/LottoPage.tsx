import DevPanel from './DevPanel.tsx'

// 개발 서버에서만 검증 화면을 보여 준다. 프로덕션은 기존 "준비 중" 그대로(Phase 5에서 UI로 교체).
export default function LottoPage() {
  return import.meta.env.DEV ? <DevPanel /> : <p>준비 중입니다.</p>
}
