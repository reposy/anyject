# 로드맵

## 완료

- Phase 0: 저장소·문서 기반
- Phase 1: 사이트 골격 (레지스트리 라우팅, 레이아웃 두 벌)
- Phase 2: Cloudflare Workers 정적 자산 배포 (workers.dev에서 동작 확인)
- Phase 3: 로또 engine + Vitest 도입
- Phase 4: 로또 Worker + hook, engine 최적화, 설정 검증 (임시 DEV 검증 화면 포함)
- Phase 5a: 로또 당첨금·세금·기대값·분기점 계산(`prize.ts`, 단위 테스트)과 DEV 전용 설정 화면(`LottoSettings.tsx`, `NumberGrid.tsx`). 시작 버튼과 시뮬레이션 연결은 5b.
- Phase 5b: 설정 화면을 시뮬레이션(hook/Worker)에 연결(시작·일시정지·재개·정지·리셋 버튼), 결과·당첨금세금 화면을 `LottoResult.tsx`/`LottoPrizeTax.tsx`로 재구성, `DevPanel` 제거, 프로덕션 공개(`/lotto`, `/embed/lotto`). 이월 항목이던 Worker 예외 처리(try/catch)와 engine 상수 export(`MAX_NUMBER`, `TICKET_SIZE`)도 처리.

### 배포 후 남은 확인

- `/lotto` 새로고침 시 정상 동작하는지
- `curl -I`로 없는 경로의 응답 코드 확인 (200 예상)
- 대시보드 빌드 감시 경로를 `react/*`로 설정할 수 있는지

## 다음 단계

1. Phase 6: 사이트 디자인 정리

## 보류·개선

- 상위 폴더 권한 영구 설정 (Claude Code `additionalDirectories`)
- `RouteErrorPage` 문구를 오류 종류별로 분리
- 스크롤 복원
- 임베드용 404 (필요 시)
- README 정리
- 도메인 확정 후 `frame-ancestors` 설정
- OG 태그가 필요해지면 프리렌더 검토
- 블로그 임베드 시 iframe 높이 처리(고정 높이 또는 postMessage 기반 자동 높이, 도메인 확정 후 검토)

## 로또 결정 요약

Phase 5a에서 당첨금·세금·분기점 계산 방식이 결정되었고(`decisions.md` 2026-09-22 항목), Phase 5b에서 실행·결과 화면 구성이 결정되었다(`decisions.md` 2026-09-22 항목, 손익 표기·실행 중 설정 잠금·결과 영역 구성·Worker 예외 처리).

- 1~3등 당첨금: 사용자가 1등만 입력하고, 2·3등은 상금 풀 배분 비율로 산출(`derivePrizeTable`)
- 세금: 2023년 개정 기준 비과세 한도·세율 적용(`afterTax`), 세전/세후 토글로 표시
- 분기점: 세전/세후 각각 정의하고 확정값을 구함(`breakEvenFirstPrize`)
- 번호 직접 입력 UI: 1~45 번호판(`NumberGrid`, 7열)
- 정지/일시정지: Worker/hook은 Phase 4에서 구현됨. 화면 버튼 연결은 Phase 5b에서 완료
- 실행 중 설정 잠금: 조건은 실행 중 잠그고, 1등 금액·세전세후는 항상 편집 가능하며 결과에 즉시 반영(Phase 5b)
- 손익 표기: "순손실"을 부호 있는 "손익"(당첨금−비용)으로 대체(Phase 5b)
