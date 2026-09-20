# CLAUDE.md

## 프로젝트 개요

- 여러 "토이"(인터랙티브 웹 도구)를 모은 정적 사이트. 배포 예정 도메인은 `web.<domain>` (도메인 미정).
- 콘텐츠 블로그는 `blog.<domain>`의 WordPress로 별도 운영한다. 이 저장소와 무관.
- 토이는 직접 방문자도 받고, 블로그 글에 iframe으로 임베드되기도 한다.

## 현재 상태

Vite React + TS 템플릿 그대로다(`src/App.tsx`는 카운터 데모). 아래 "(예정)" 표기는 아직 존재하지 않는 구조이며, 구현되기 전까지 있는 것처럼 다루지 말 것.

## 스택과 배포

- React + Vite + TypeScript, Cloudflare Pages 정적 배포. 라이브러리는 현재 안정 버전 기준.
- 데이터가 필요해지면 AWS Lambda 연동 예정(현재 없음).

## 저장소 구조

- git 루트는 상위 폴더 `anyject`(모노레포). 이 폴더(`react/`)는 프론트엔드 프로젝트.
- 추후 lambda, spring, python 등 백엔드가 형제 폴더로 추가될 수 있다.

## 명령어

- `npm run dev` — 개발 서버(HMR)
- `npm run build` — `tsc -b` 후 `vite build` (출력: `dist/`)
- `npm run lint` — ESLint 전체
- `npm run preview` — 프로덕션 빌드 로컬 서빙
- 테스트 러너 없음(Vitest 도입 예정, 미설치). 단일 파일 린트: `npx eslint src/App.tsx`

## TypeScript 설정 주의점

`tsconfig.app.json`: `verbatimModuleSyntax`(타입은 `import type`), `erasableSyntaxOnly`(`enum`/namespace/생성자 파라미터 프로퍼티 금지), `noUnusedLocals`/`noUnusedParameters`.

## 폴더 규칙 (예정)

- `src/app`: 라우터, 레이아웃
- `src/shared`: 공용 UI, 훅, 유틸
- `src/toys/<slug>/`: 토이 하나 = 폴더 하나 (meta, 페이지, 필요 시 engine/worker)
- `src/toys/registry.ts`: 모든 토이 meta를 모으는 단일 출처. 라우트, 홈 목록 등은 여기서 생성한다.
- 토이 목록/설명은 레지스트리와 각 meta를 참고한다. 별도 목록 문서를 만들지 말 것(중복 금지).

## 새 토이 추가 절차 (예정)

1. 폴더 생성 → 2. meta 작성 → 3. 레지스트리 등록 → 4. 코드만으로 알 수 없는 도메인 규칙이 있을 때만 해당 폴더에 CLAUDE.md 작성.

토이 컴포넌트는 `React.lazy`로 코드 분할한다.

## 계층 원칙

- engine: 순수 함수. 단위 테스트 대상.
- 무거운 연산은 Web Worker에서 실행한다. 메인 스레드 블로킹 금지.
- UI는 hook을 통해 engine/worker 상태를 구독한다.

## 레이아웃 두 벌 (예정)

- 직접 URL `/<slug>`: 헤더, 내비, 푸터 포함.
- 임베드 `/embed/<slug>`: 토이만 표시, `noindex`, canonical은 직접 URL.
- 임베드 경로만 `blog.<domain>`에서 iframe 허용(`frame-ancestors`, Cloudflare `_headers`로 설정 예정).
- 같은 토이 컴포넌트를 두 레이아웃에서 재사용한다.

## 광고

당분간 토이 페이지에 광고 없음. 추후 도입해도 임베드에는 넣지 않는다.

## 개발 원칙

중복 배제, 프로젝트 일관성, 적정 기술(오버 엔지니어링 지양).

## 작업 방식

- 단계 작업은 계획을 먼저 제시하고 승인 후 실행한다.
- 결정 사항이 생기면 `../docs/decisions.md`에 기록한다.
- 작업 완료 보고 형식: 수행한 것 / 수행하지 않은 것(이유) / 사용자가 확인할 것 + `git status --short`와 `git diff --stat`.
- 커밋은 사용자가 검토 후 직접 한다. 요청 없이 커밋하지 말 것.
