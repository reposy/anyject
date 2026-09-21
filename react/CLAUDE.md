# CLAUDE.md

## 프로젝트 개요

- 여러 "토이"(인터랙티브 웹 도구)를 모은 정적 사이트. 배포 예정 도메인은 `web.<domain>` (도메인 미정).
- 콘텐츠 블로그는 `blog.<domain>`의 WordPress로 별도 운영한다. 이 저장소와 무관.
- 토이는 직접 방문자도 받고, 블로그 글에 iframe으로 임베드되기도 한다.

## 현재 상태

사이트 골격 완료: 레지스트리 기반 라우팅(`/`, `/<slug>`, `/embed/<slug>`, 404)과 레이아웃 두 벌이 동작한다. 로또 engine(`src/toys/lotto/engine.ts`)과 단위 테스트(Vitest)가 있다. 유일한 토이 `lotto`의 화면은 아직 "준비 중" 페이지뿐이며 worker, hook, UI는 없다. "(예정)" 표기는 아직 존재하지 않는 구조이며, 구현되기 전까지 있는 것처럼 다루지 말 것.

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
