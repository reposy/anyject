import { Suspense, type ReactNode } from 'react'
import type { ToyMeta } from '../toys/types.ts'
import { SITE_NAME } from './site.ts'

export function ToyView({ toy, children }: { toy: ToyMeta; children: ReactNode }) {
  return (
    <>
      <title>{`${toy.title} | ${SITE_NAME}`}</title>
      <Suspense fallback={<p>불러오는 중…</p>}>{children}</Suspense>
    </>
  )
}
