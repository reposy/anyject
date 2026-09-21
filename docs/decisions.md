# 결정 기록

날짜 / 결정 / 이유 / (선택) 재검토 조건을 짧게 기록한다. 새 결정은 아래에 추가한다.

## 2026-09-20 [repo] 모노레포 채택 (git 루트 `anyject`)

- 결정: git 루트를 상위 폴더 `anyject`로 두고, `react/`는 그 안의 프론트엔드 프로젝트로 둔다.
- 이유: 백엔드(lambda, spring, python 등) 추가 예정이며, 프론트/백엔드를 동시에 변경하기 쉽다.

## 2026-09-20 [react] 토이 레지스트리를 단일 출처로 사용

- 결정: `src/toys/registry.ts`가 모든 토이 meta를 모으고, 라우트와 홈 목록 등은 여기서 생성한다.
- 이유: 토이 목록이 여러 곳에 중복되는 것을 막는다. 별도 목록 문서도 만들지 않는다.

## 2026-09-20 [react] 직접 URL과 임베드는 같은 컴포넌트 + 다른 레이아웃

- 결정: `/<slug>`(헤더/내비/푸터 포함)와 `/embed/<slug>`(토이만, noindex, canonical은 직접 URL)가 같은 토이 컴포넌트를 쓰고 레이아웃만 다르다.
- 이유: 토이 코드 중복 없이 직접 방문과 블로그 iframe 임베드를 모두 지원한다.

## 2026-09-20 [react] 토이 페이지 광고 보류

- 결정: 당분간 광고를 넣지 않고, 도입하더라도 임베드에는 넣지 않는다.
- 이유: 광고 승인 가능성 문제, 그리고 조작 UI 근처 광고로 인한 무효 클릭 위험.
- 재검토 조건: 블로그 애드센스 승인 후, 토이 트래픽 확인 시

## 2026-09-20 [react] 첫 토이: 로또 당첨 시뮬레이터

- 결정: 목표 등수(1~4등)를 선택하고, "목표 등수 이상"에 당첨되면 정지한다. 고정 번호/자동 방식은 입력 방식만 분기하고 engine은 하나로 유지한다.
- 이유: 고정 번호와 자동 방식은 당첨 확률이 통계적으로 동일하므로 engine을 나눌 필요가 없다.

## 2026-09-20 [react] 라우터: react-router 8.x 라이브러리 모드

- 결정: `react-router`를 라이브러리 모드(`createBrowserRouter` + `RouterProvider`)로 쓴다. 프레임워크 모드, SSR, 프리렌더는 도입하지 않는다. 토이 라우트는 레지스트리(`toys`)에서 `map`으로 생성하고, 미등록 경로와 `/embed` 단독은 404 페이지(`noindex`)로 처리한다.
- 이유: Cloudflare Pages 정적 SPA 배포에 충분하고, 토이 페이지는 검색 유입이 핵심이 아니며 임베드는 어차피 `noindex`다. SPA 폴백은 `404.html` 없이 Pages 기본 동작에 맡긴다(이 경우 미등록 경로도 200이 반환되므로 404 페이지에 `noindex`를 둔다).
- 재검토 조건: 토이별 공유 미리보기(OG 태그)가 필요해질 때 프리렌더 도입 검토

## 2026-09-20 [react] 토이 meta 최소 4필드

- 결정: `ToyMeta`는 `slug`, `title`, `description`, `load`(lazy 로더)만 둔다.
- 이유: 현재 라우트, 홈 목록, `<title>`에 필요한 것만 둔다(적정 기술).
- 재검토 조건: 홈에서 아이콘, 태그, 정렬 등이 필요해질 때 필드 추가

## 2026-09-20 [repo] 배포 대상: Pages 대신 Cloudflare Workers 정적 자산

- 결정: 배포 대상을 Cloudflare Pages에서 Workers 정적 자산으로 한다(`react/wrangler.jsonc`, Worker 이름 `anyject`, `assets.not_found_handling: "single-page-application"`, Worker 스크립트 없음). 배포는 대시보드의 GitHub 연동 빌드(Workers Builds)로 한다. 앞선 라우터 결정의 "Pages SPA 폴백" 전제는 이 결정으로 대체된다.
- 이유: Cloudflare가 신규 프로젝트에 Pages 대신 Workers 정적 자산을 권장하고 Pages는 유지 모드이며, 비용은 동일하다.
- 재검토 조건: Workers Builds가 모노레포 루트 디렉터리/빌드 감시 경로를 지원하지 않을 때

## 2026-09-20 [repo] 백엔드 방침: 기본 Cloudflare Workers, 예외적으로 AWS Lambda

- 결정: API는 기본적으로 Cloudflare Workers로 추가한다. 실행 시간, 메모리, 언어(Java 등) 제약에 걸리는 작업만 예외적으로 AWS Lambda로 분리한다.
- 이유: 관리 지점을 최소화한다.
- 재검토 조건: Lambda로 분리된 작업이 여러 개로 늘어날 때

## 2026-09-21 [react] 로또 반복 규칙

- 결정: 사용자가 최대 반복 횟수를 지정하거나 무한 반복을 선택한다. 목표 등수 이상 당첨 또는 횟수 소진 시 정지한다.
- 이유: 원래 요구사항("무한 반복 가능한 횟수 설정")을 따른다.

## 2026-09-21 [react] 로또 결과 표시 원칙

- 결정: 목표 등수 선택 시 기대 횟수와 비용을 인라인으로 바로 표시한다. 1~3등 당첨금은 평균 추정치로 계산하고 UI에 추정치임을 명시하며, 4·5등은 고정 금액을 쓴다. 지표는 누적 비용(회당 1,000원), 2~5등 당첨 횟수, 누적 당첨금, 순손실, "매주 1장 구매 시 N년" 환산이다.
- 이유: hover 툴팁은 모바일에서 동작하지 않는다. 1~3등은 회차마다 금액이 달라 정확한 값을 쓸 수 없다.

## 2026-09-21 [react] Vitest 설정 방식

- 결정: `vitest`만 devDependency로 추가하고, 설정은 별도 파일 없이 `vite.config.ts`의 `test` 필드에 둔다(`defineConfig`는 `vitest/config`에서 import). 환경은 node, `globals`는 끄고 테스트에서 명시 import한다. 테스트는 `src/**/*.test.ts`에 두고 `tsc -b`와 lint 대상에 포함한다. jsdom, testing-library는 설치하지 않는다.
- 이유: 설정 중복을 막고, engine은 DOM이 필요 없어 node 환경으로 충분하다.
- 재검토 조건: 컴포넌트/hook 테스트가 필요해질 때 jsdom과 testing-library 도입 검토

## 2026-09-21 [react] 로또 engine 배치 구조

- 결정: 시뮬레이션 상태는 직렬화 가능한 plain object(`attempts`, 등수별 `wins`, 정지 시 `stop: { reason, draw, ticket }`)이고, `runBatch(state, config, batchSize, rng)`가 입력을 변경하지 않고 새 상태를 반환한다. 시도마다 rng 소비량이 고정(자동: 티켓 6 + 추첨 7, 고정: 추첨 7)이라 같은 시드에서 배치 분할과 무관하게 결과가 같다. 정지 판정은 매 시도 후이며 목표 도달(`target`)이 횟수 소진(`limit`)보다 우선한다. 정지된 상태로 호출하면 같은 상태를 그대로 반환한다.
- 이유: 추후 Worker에서 배치 단위로 실행하고 진행 상태를 postMessage로 전달하기 위함이다. 정지/일시정지도 배치 경계에서 처리할 수 있다.
- 성능 최적화(비트마스크, 타입 배열 등)는 도입하지 않았다. Worker 단계에서 측정 후 필요할 때 결정한다.

## 2026-09-21 [react] engine의 난수는 주입

- 결정: engine은 `Rng = () => number`([0, 1))를 인자로 받으며 `Math.random`을 직접 호출하지 않는다. 테스트는 직접 작성한 시드 PRNG(mulberry32)로 재현 가능하게 검증한다.
- 이유: 결과 재현과 배치 불변성 테스트를 위해서다. 시드 라이브러리는 쓰지 않는다.

## 2026-09-21 [react] 당첨금 표는 engine 인자로 받음

- 결정: 요약 계산(`summarize`)은 `Record<Rank, number>` 당첨금 표를 인자로 받는다. engine이 export하는 상수는 4·5등 고정 금액(50,000원/5,000원)뿐이며, 1~3등 금액은 engine에 넣지 않는다.
- 이유: 1~3등은 회차마다 달라 평균 추정치를 쓰고, 그 기준(기간, 출처)은 아직 미정이므로 호출 측(UI)이 정한다.

## 2026-09-21 [react] 로또 engine 할당 제거 최적화 (앞선 "최적화 미도입"을 대체)

- 결정: 시도마다 새로 만들던 번호 풀, slice, sort, filter/includes를 없앴다. `runBatch` 호출 안에서만 존재하는 재사용 버퍼(`Uint8Array`: 번호 풀 45, 자동 티켓 6, 조회 표 46)와 상수 조회 표(`IDENTITY`)를 쓴다. 번호 뽑기(`sampleInto`)와 등수 판정(`judge`)은 각각 한 곳에만 있고, 공개 함수(`pickDistinct`, `rankOf` 등)와 핫 루프가 같은 코드를 탄다. 뽑을 때마다 풀을 1..45로 되돌려 rng 호출 순서·횟수와 결과가 최적화 전과 동일하다. 정렬과 배열 생성은 정지 시점에 저장하는 티켓/추첨에만 한다.
- 근거(측정): Node v24.21.0, AMD Ryzen 5 7500X3D, `Math.random` 주입, 100만 시도, 워밍업 후 5회 중앙값(브라우저 Worker의 절대값은 다를 수 있다).
  - 자동: 4,280 → 140 ns/시도 (약 30배)
  - 고정: 2,170 → 87 ns/시도 (약 25배)
  - Worker와 같은 1,000시도 청크 반복도 차이 없음(자동 134, 고정 82 ns).
  - 결과적으로 목표 1등(기대 약 815만 시도)은 Node에서 평균 1~2초 안팎이다.
- 검증: 최적화 전 engine으로 기록한 골든 테스트(자동/고정 × 목표 1~4등, target/limit 정지, 고정 시드 16건의 attempts, wins, stop 전체)와 기존 테스트가 수정 없이 통과한다.
- 이유: 자동 방식 시도당 약 4~5µs로는 1등 기대 시도를 감당하기 어렵다.

## 2026-09-21 [react] 로또 설정 검증은 engine의 순수 함수 `validateConfig`

- 결정: `validateConfig(config)`가 `target`(1~4 정수), `maxAttempts`(null 또는 1 이상의 안전 정수), 고정 티켓(`validateTicket`)을 이 순서로 검사해 첫 오류를 예외 없이 값(`{ ok, config | error }`)으로 돌려준다. 성공 시 티켓이 정렬된 새 config를 돌려준다. 호출은 hook의 `start` 전(무효면 Worker를 만들지 않고 결과를 반환)과 Worker의 `start` 수신 시(실패하면 `error` 메시지) 두 곳이다.
- 이유: 검증 규칙을 engine 한 곳에 두어 단위 테스트로 검증하고, hook/Worker(테스트 없음)는 얇게 유지한다. Worker 재검증은 메시지 경계의 방어선이다.

## 2026-09-21 [react] 로또 Worker 프로토콜과 실행 방식

- 결정: 메시지는 판별 유니언(`protocol.ts`, enum 없음). 메인→Worker: `start{config}`, `pause`, `resume`. Worker→메인: `progress{state}`, `finished{state}`, `error{message}`. Worker 하나는 `start`를 한 번만 처리하고, 재시작은 항상 기존 Worker를 dispose(핸들러 분리 → terminate)한 뒤 새 Worker를 만든다. 사용자 정지 메시지는 두지 않는다.
- 실행: `runBatch`를 1,000시도 청크로 반복하되 20ms 슬라이스마다 `MessageChannel` 자기 메시지로 이벤트 루프에 양보해 pause를 받는다(`setTimeout(0)`은 4ms 클램프 때문에 쓰지 않음). 진행 상태는 100ms(초당 10회)마다 보내고, pause 처리 시 현재 상태를 즉시 한 번 보낸다. rng는 Worker에서 `Math.random`을 주입한다.
- 이유: 재시작 시 이전 run의 메시지가 새 run과 섞여 hook이 오전환하는 경쟁을 구조적으로 없앤다. 슬라이스와 전송 주기는 pause 반응성과 메인 스레드 렌더 부하의 절충이다.
- 재검토 조건: 실제 UI에서 진행 갱신이 부담되거나 pause 반응이 느릴 때 값 조정

## 2026-09-21 [react] 로또 hook status 모델과 사용자 정지

- 결정: `useLottoSimulation`의 status는 `idle | running | paused | finished | stopped | error`. `finished`는 engine 정지(`state.stop !== null`), `stopped`는 사용자 정지(`state.stop === null`)이며 engine의 `StopReason`에는 사용자 정지를 넣지 않는다. 사용자 정지는 응답을 기다리지 않고 Worker를 즉시 dispose하며 마지막으로 받은 `SimState`를 유지한다(최대 ~100ms 이전 값). `reset`은 idle과 초기 상태로 돌린다. `worker.onerror`, `onmessageerror`, `error` 메시지는 모두 `error` status로 처리하고 Worker를 dispose한다. hook은 `summarize`를 호출하지 않는다(당첨금 표는 UI가 정한다).
- Worker는 이펙트가 아니라 `start()`에서 만들고, 언마운트 이펙트는 dispose만 하므로 StrictMode의 이중 이펙트에서도 누수가 없다.
- 이유: 정지 응답 대기 상태와 Worker 무응답 시 멈춤 위험이 최대 100ms 정확도 차이보다 비용이 크다.

## 2026-09-21 [react] 로또 DEV 전용 검증 화면

- 결정: `LottoPage`는 `import.meta.env.DEV`일 때만 스타일 없는 `DevPanel`(조작 버튼과 status/SimState JSON)을 렌더하고, 프로덕션은 기존 "준비 중"을 유지한다. 프로덕션 빌드에서 DevPanel은 트리셰이킹되며(로또 청크에 없음) Worker 파일은 별도 자산으로 emit되지만 프로덕션에서는 로드되지 않는다. 프로덕션의 Worker 번들 검증은 Phase 5에서 UI와 함께 한다.
- 이유: UI(Phase 5) 전에 Worker와 hook을 사람이 직접 조작해 검증하기 위해서다.
