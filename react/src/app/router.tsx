import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'
import { toys } from '../toys/registry.ts'
import { EmbedHead } from './EmbedHead.tsx'
import { EmbedLayout } from './EmbedLayout.tsx'
import { HomePage } from './HomePage.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'
import { SiteLayout } from './SiteLayout.tsx'
import { ToyView } from './ToyView.tsx'

// 토이당 lazy는 한 번만 만들고, 직접 URL과 임베드 라우트가 같은 컴포넌트를 공유한다.
const toyViews = toys.map((toy) => {
  const Toy = lazy(toy.load)
  return {
    slug: toy.slug,
    view: (
      <ToyView toy={toy}>
        <Toy />
      </ToyView>
    ),
  }
})

export const router = createBrowserRouter([
  {
    path: 'embed',
    element: <EmbedLayout />,
    children: [
      { index: true, element: <NotFoundPage /> },
      ...toyViews.map(({ slug, view }) => ({
        path: slug,
        element: (
          <>
            <EmbedHead slug={slug} />
            {view}
          </>
        ),
      })),
    ],
  },
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      ...toyViews.map(({ slug, view }) => ({ path: slug, element: view })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
