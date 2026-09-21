# 로드맵

## 완료

- Phase 0: 저장소·문서 기반
- Phase 1: 사이트 골격 (레지스트리 라우팅, 레이아웃 두 벌)
- Phase 2: Cloudflare Workers 정적 자산 배포 (workers.dev에서 동작 확인)
- Phase 3: 로또 engine + Vitest 도입

### 배포 후 남은 확인

- `/lotto` 새로고침 시 정상 동작하는지
- `curl -I`로 없는 경로의 응답 코드 확인 (200 예상)
- 대시보드 빌드 감시 경로를 `react/*`로 설정할 수 있는지

## 다음 단계

1. Phase 4: Worker + hook
2. Phase 5: 로또 UI
3. Phase 6: 사이트 디자인 정리

## 보류·개선

- 상위 폴더 권한 영구 설정 (Claude Code `additionalDirectories`)
- `RouteErrorPage` 문구를 오류 종류별로 분리
- 스크롤 복원
- 임베드용 404 (필요 시)
- README 정리
- 도메인 확정 후 `frame-ancestors` 설정
- OG 태그가 필요해지면 프리렌더 검토

## 로또 미정 사항

- 1~3등 평균 당첨금의 기준 (기간, 출처)
- 정지/일시정지: engine은 배치 구조로 대응, UI 지원 여부 미정
- 번호 직접 입력 UI 형태
