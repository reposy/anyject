import type { ToyMeta } from '../types.ts'

export const lottoMeta: ToyMeta = {
  slug: 'lotto',
  title: '로또 당첨 시뮬레이터',
  description: '목표 등수에 당첨될 때까지 로또를 몇 번 사야 하는지 시뮬레이션합니다.',
  load: () => import('./LottoPage.tsx'),
}
