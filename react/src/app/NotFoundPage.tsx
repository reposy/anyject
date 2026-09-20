import { Link } from 'react-router'
import { SITE_NAME } from './site.ts'

export function NotFoundPage() {
  return (
    <>
      {/* Pages SPA 폴백이 200을 반환하므로 404 페이지는 색인되지 않게 한다. */}
      <meta name="robots" content="noindex" />
      <title>{`페이지를 찾을 수 없습니다 | ${SITE_NAME}`}</title>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>
        <Link to="/">홈으로</Link>
      </p>
    </>
  )
}
