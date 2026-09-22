# 로드맵

## 완료

- Phase 0: 저장소·문서 기반
- Phase 1: 사이트 골격 (레지스트리 라우팅, 레이아웃 두 벌)
- Phase 2: Cloudflare Workers 정적 자산 배포 (workers.dev에서 동작 확인)
- Phase 3: 로또 engine + Vitest 도입
- Phase 4: 로또 Worker + hook, engine 최적화, 설정 검증 (임시 DEV 검증 화면 포함)
- Phase 5a: 로또 당첨금·세금·기대값·분기점 계산(`prize.ts`, 단위 테스트)과 DEV 전용 설정 화면(`LottoSettings.tsx`, `NumberGrid.tsx`). 시작 버튼과 시뮬레이션 연결은 5b.

### 배포 후 남은 확인

- `/lotto` 새로고침 시 정상 동작하는지
- `curl -I`로 없는 경로의 응답 코드 확인 (200 예상)
- 대시보드 빌드 감시 경로를 `react/*`로 설정할 수 있는지

## 다음 단계

1. Phase 5b: 설정 화면(`LottoSettings`)을 시뮬레이션(hook/Worker)에 연결(시작·일시정지·재개·정지 버튼), `DevPanel` 제거, 프로덕션 공개(Worker 번들 검증 포함)
   - 이월: `worker.ts`의 `drive()`가 예외를 try/catch로 잡지 않는다. 현재는 `runBatch` 등이 예기치 않게 던지면 `error` 메시지 없이 처리되지 않은 rejection으로 끝난다. try/catch로 감싸 `error` 메시지로 보내도록 고친다.
2. Phase 6: 사이트 디자인 정리

## 보류·개선

- 상위 폴더 권한 영구 설정 (Claude Code `additionalDirectories`)
- `RouteErrorPage` 문구를 오류 종류별로 분리
- 스크롤 복원
- 임베드용 404 (필요 시)
- README 정리
- 도메인 확정 후 `frame-ancestors` 설정
- OG 태그가 필요해지면 프리렌더 검토

## 로또 결정 요약

Phase 5a에서 모두 결정되었다(근거는 `decisions.md` 2026-09-22 항목 참고).

- 1~3등 당첨금: 사용자가 1등만 입력하고, 2·3등은 상금 풀 배분 비율로 산출(`derivePrizeTable`)
- 세금: 2023년 개정 기준 비과세 한도·세율 적용(`afterTax`), 세전/세후 토글로 표시
- 분기점: 세전/세후 각각 정의하고 확정값을 구함(`breakEvenFirstPrize`)
- 번호 직접 입력 UI: 1~45 번호판(`NumberGrid`, 7열)
- 정지/일시정지: Worker/hook은 Phase 4에서 구현됨. 화면 버튼 연결은 Phase 5b
