export function RouteErrorPage() {
  return (
    <>
      {/* 새 배포로 이전 청크가 사라져 로드에 실패한 경우를 안내한다. 레이아웃 없이 단독 표시. */}
      <meta name="robots" content="noindex" />
      <title>불러오지 못했습니다</title>
      <p>새 버전이 배포되었을 수 있습니다. 새로고침해 주세요.</p>
      <button type="button" onClick={() => window.location.reload()}>
        새로고침
      </button>
    </>
  )
}
