# CLAUDE.md

## 프로젝트 개요

- 여러 "토이"(인터랙티브 웹 도구)를 모은 정적 사이트. 배포 예정 도메인은 `web.<domain>` (도메인 미정).
- 콘텐츠 블로그는 `blog.<domain>`의 WordPress로 별도 운영한다. 이 저장소와 무관.
- 토이는 직접 방문자도 받고, 블로그 글에 iframe으로 임베드되기도 한다.

## 현재 상태

사이트 골격 완료: 레지스트리 기반 라우팅(`/`, `/<slug>`, `/embed/<slug>`, 404)과 레이아웃 두 벌이 동작한다. 유일한 토이 `lotto`는 프로덕션에 공개되어 있다: `/lotto`와 `/embed/lotto` 모두 실제 시뮬레이터 화면을 렌더한다(DEV 전용 분기와 임시 검증 화면 `DevPanel.tsx`는 Phase 5b에서 제거됨). 화면은 조건 설정 → 시작/일시정지/재개/정지/리셋 → 결과(상태, 누적 시도·비용·당첨금, 손익, 등수별 당첨 횟수, 완료 시 추첨/티켓) → 당첨금·세금(1등 입력, 세전/세후 토글, 통합 표) → 분기점 순으로 구성된다(`LottoPage.tsx`가 상태를 소유하고, `LottoResult.tsx`/`LottoPrizeTax.tsx`가 표시를 맡는다). 계산은 engine(`src/toys/lotto/engine.ts`)과 prize(`prize.ts`)의 순수 함수, 실행은 Worker와 hook(`worker.ts`, `useLottoSimulation.ts`)이 맡는다. hook과 Worker에는 단위 테스트가 없다. "(예정)" 표기는 아직 존재하지 않는 구조이며, 구현되기 전까지 있는 것처럼 다루지 말 것.

## 스택과 배포

- React + Vite + TypeScript, Cloudflare Workers 정적 자산 배포(`wrangler.jsonc`, Worker 이름 `anyject`, 정적 자산만 서빙하고 Worker 스크립트 없음). 배포는 대시보드의 GitHub 연동 빌드(Workers Builds)로 한다. 라이브러리는 현재 안정 버전 기준.
- 라우팅: react-router 라이브러리 모드(`createBrowserRouter` + `RouterProvider`). 프레임워크 모드, SSR, 프리렌더는 쓰지 않는다. SPA 폴백은 `wrangler.jsonc`의 `assets.not_found_handling: "single-page-application"`으로 처리하므로 `public/404.html`을 만들지 말 것.
- 청크 로드 실패(새 배포 후 이전 청크 소실)는 두 최상위 라우트의 `errorElement`(`RouteErrorPage`)가 새로고침 안내로 처리한다.
- `<title>`, `<meta>`, `<link>`는 React 19 문서 메타데이터 기능(컴포넌트 안에서 직접 렌더)으로 출력한다. 헤드 관리 라이브러리 설치 금지.
- 데이터가 필요해지면 API는 기본적으로 Cloudflare Workers로 추가하고, 실행 시간/메모리/언어 제약에 걸리는 작업만 AWS Lambda로 분리한다(현재 백엔드 없음. `../docs/decisions.md` 참고).

## 저장소 구조

- git 루트는 상위 폴더 `anyject`(모노레포). 이 폴더(`react/`)는 프론트엔드 프로젝트.
- 추후 lambda, spring, python 등 백엔드가 형제 폴더로 추가될 수 있다.

## 명령어

- `npm run dev` — 개발 서버(HMR)
- `npm run build` — `tsc -b` 후 `vite build` (출력: `dist/`)
- `npm run lint` — ESLint 전체
- `npm run preview` — 프로덕션 빌드 로컬 서빙
- `npm run preview:cf` — `wrangler dev`로 `dist/`를 Workers 정적 자산 방식으로 로컬 서빙(SPA 폴백 확인용, 로그인 불필요). 먼저 `npm run build` 필요. `wrangler login`/`wrangler deploy`는 실행하지 않는다(배포는 GitHub 연동).
- `npm run test` — Vitest 1회 실행(`src/**/*.test.ts`)
- `npm run test:watch` — Vitest 감시 모드
- 단일 파일 테스트: `npx vitest run src/toys/lotto/engine.test.ts`. 단일 파일 린트: `npx eslint src/App.tsx`

## TypeScript 설정 주의점

`tsconfig.app.json`: `verbatimModuleSyntax`(타입은 `import type`), `erasableSyntaxOnly`(`enum`/namespace/생성자 파라미터 프로퍼티 금지), `noUnusedLocals`/`noUnusedParameters`.

테스트 파일(`*.test.ts`)은 `src` 안에 두며 `tsc -b` 대상이다. Vitest는 `globals`를 끄고 node 환경으로 돌리므로 `describe`/`it`/`expect`는 `vitest`에서 명시 import한다. 설정은 `vite.config.ts`의 `test` 필드(`defineConfig`는 `vitest/config`에서 import).

## 폴더 규칙

- `src/app`: 라우터(`router.tsx`), 레이아웃(`SiteLayout`, `EmbedLayout`), 홈/404 페이지, 로드 실패 화면(`RouteErrorPage`), `ToyView`, `EmbedHead`, 사이트명(`site.ts`)
- `src/shared` (예정): 공용 UI, 훅, 유틸. 공용화할 코드가 생기면 만든다.
- `src/toys/<slug>/`: 토이 하나 = 폴더 하나 (`meta.ts`, 페이지 컴포넌트, 필요 시 engine/worker)
- `src/toys/lotto/` 구성: `engine.ts`(순수 로직, 설정 검증 `validateConfig` 포함), `prize.ts`(당첨금·세금·기대값·분기점·부호 있는 금액 표시 순수 함수, `prize.test.ts`), `messages.ts`(`ConfigError`를 화면 문구로 바꾸는 `describeConfigError`, `messages.test.ts`), `protocol.ts`(메인↔Worker 메시지 타입, 공유), `worker.ts`(시간 배분과 메시지만, 계산은 engine, 예외는 `error` 메시지로 전송), `useLottoSimulation.ts`(Worker 수명과 status를 다루는 hook), `LottoPage.tsx`(상태 소유자: 조건 입력, 실행 버튼, 하위 컴포넌트 조립), `LottoResult.tsx`(결과 표시), `LottoPrizeTax.tsx`(당첨금·세금·분기점 표시), `LottoPanel.module.css`(이 세 컴포넌트가 함께 쓰는 스타일), `NumberGrid.tsx`/`NumberGrid.module.css`(1~45 번호판), `meta.ts`. engine을 고칠 때는 `engine.test.ts`의 골든 테스트(고정 시드 결과 리터럴)가 rng 호출 순서와 결과를 고정하고 있으므로 기대값을 바꿔서 통과시키지 말 것.
- `src/toys/types.ts`: `ToyMeta` 타입 (slug, title, description, load)
- `src/toys/registry.ts`: 모든 토이 meta를 모으는 단일 출처(`toys` 배열). 라우트, 홈 목록 등은 여기서 생성한다.
- 토이 목록/설명은 레지스트리와 각 meta를 참고한다. 별도 목록 문서를 만들지 말 것(중복 금지).

## 새 토이 추가 절차

1. `src/toys/<slug>/` 폴더 생성
2. `meta.ts`에 `ToyMeta` 작성. `load: () => import('./<Page>.tsx')`
3. 페이지 컴포넌트를 default export로 작성
4. `src/toys/registry.ts`의 `toys`에 meta 추가. 라우트와 홈 목록은 자동 반영되므로 `router.tsx`는 건드리지 않는다.
5. 코드만으로 알 수 없는 도메인 규칙이 있을 때만 해당 폴더에 CLAUDE.md 작성.

토이 컴포넌트는 `React.lazy`(`router.tsx`에서 생성)와 `Suspense`(`ToyView`)로 코드 분할한다. `lazy`는 렌더 중에 만들지 말 것(`react-hooks/static-components` 린트).

## 계층 원칙

- engine: 순수 함수. 단위 테스트 대상.
- 무거운 연산은 Web Worker에서 실행한다. 메인 스레드 블로킹 금지.
- UI는 hook을 통해 engine/worker 상태를 구독한다.

## 스타일

- CSS Modules(`*.module.css`)를 쓴다. 컴포넌트와 같은 폴더에 co-locate하고(예: `LottoSettings.tsx` ↔ `LottoSettings.module.css`), 클래스 이름은 컴포넌트 안에서 `styles.xxx`로만 참조한다.
- 전역 스타일은 `src/index.css`(리셋 수준)와 `src/app/layout.css`(사이트 레이아웃)뿐이다. 새 전역 규칙을 추가하지 말고, 토이별 스타일은 각 토이 폴더의 CSS Modules로만 한다.
- 색상은 하드코딩을 최소화한다. 테두리·강조색처럼 배경에 따라 달라져야 하는 값은 `layout.css`처럼 `color-mix(in srgb, currentColor N%, transparent)`로 `currentColor` 기준 로컬 변수를 만들어 쓴다.
- 사이트 전체 디자인 정리는 Phase 6에서 한다. 그 전까지 토이 스타일은 읽기 쉬운 최소한으로 유지한다.

## 레이아웃 두 벌

- 직접 URL `/<slug>`: 헤더, 푸터 포함(`SiteLayout`). 내비는 홈 링크뿐.
- 임베드 `/embed/<slug>`: 토이만 표시(`EmbedLayout`), `noindex`, canonical은 직접 URL(`EmbedHead`, origin은 `window.location.origin`).
- `/embed` 단독과 미등록 경로는 404 페이지(`noindex` 포함. SPA 폴백이 200을 반환하기 때문).
- 임베드 경로만 `blog.<domain>`에서 iframe 허용(`frame-ancestors`, 설정 방식은 도메인 확정 후 결정. `_headers` 파일은 아직 만들지 않는다).
- 같은 토이 컴포넌트(`ToyView`)를 두 레이아웃에서 재사용한다.

## 광고

당분간 토이 페이지에 광고 없음. 추후 도입해도 임베드에는 넣지 않는다.

## 개발 원칙

중복 배제, 프로젝트 일관성, 적정 기술(오버 엔지니어링 지양).

## 작업 방식

- 단계 작업은 계획을 먼저 제시하고 승인 후 실행한다.
- 결정 사항이 생기면 `../docs/decisions.md`에 기록한다.
- 작업 완료 보고 형식: 수행한 것 / 수행하지 않은 것(이유) / 사용자가 확인할 것 + `git status --short`와 `git diff --stat`.
- 커밋은 사용자가 검토 후 직접 한다. 요청 없이 커밋하지 말 것.
