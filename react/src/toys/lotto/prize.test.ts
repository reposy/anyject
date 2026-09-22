import { describe, expect, it } from 'vitest'
import { RANKS } from './engine.ts'
import type { Rank } from './engine.ts'
import {
  afterTax,
  breakEvenFirstPrize,
  derivePrizeTable,
  expectedValueTotal,
  formatPercentDecimal,
  formatSignedWon,
  formatWon,
  formatWonDecimal,
  prizeTableFor,
  toAfterTaxTable,
  validateFirstPrizeInput,
} from './prize.ts'

const EOK = 100_000_000

describe('derivePrizeTable', () => {
  it('20억 기준 1~5등 세전 당첨금', () => {
    expect(derivePrizeTable(20 * EOK)).toEqual({
      1: 2_000_000_000,
      2: 55_555_555,
      3: 1_461_988,
      4: 50_000,
      5: 5_000,
    })
  })
})

describe('afterTax', () => {
  it('200만 원 이하는 비과세', () => {
    expect(afterTax(2_000_000)).toBe(2_000_000)
  })
  it('200만 1원부터 과세', () => {
    expect(afterTax(2_000_001)).toBe(1_560_221)
  })
  it('과세표준 3억 경계(이하는 22%만)', () => {
    expect(afterTax(300_001_000)).toBe(234_001_000)
  })
  it('과세표준 3억 1원 초과(33% 구간 진입)', () => {
    expect(afterTax(300_001_001)).toBe(234_001_001)
  })
  it('과세표준 3억을 크게 넘으면 초과분만 33%', () => {
    expect(afterTax(400_001_000)).toBe(301_001_000)
  })
})

describe('toAfterTaxTable / prizeTableFor', () => {
  it('세후 표의 모든 등수는 세전 표보다 크지 않다', () => {
    for (const firstPrize of [1 * EOK, 5 * EOK, 20 * EOK, 71 * EOK, 1000 * EOK]) {
      const pretax = derivePrizeTable(firstPrize)
      const posttax = toAfterTaxTable(pretax)
      for (const rank of RANKS) {
        expect(posttax[rank]).toBeLessThanOrEqual(pretax[rank])
      }
    }
  })

  it('prizeTableFor는 모드에 따라 derivePrizeTable/toAfterTaxTable과 같다', () => {
    const firstPrize = 20 * EOK
    expect(prizeTableFor(firstPrize, 'pre')).toEqual(derivePrizeTable(firstPrize))
    expect(prizeTableFor(firstPrize, 'post')).toEqual(toAfterTaxTable(derivePrizeTable(firstPrize)))
  })
})

describe('expectedValueTotal', () => {
  it('20억 세전 기대액 합계는 약 508원', () => {
    const total = expectedValueTotal(derivePrizeTable(20 * EOK))
    expect(total).toBeGreaterThan(505)
    expect(total).toBeLessThan(511)
  })
})

describe('breakEvenFirstPrize', () => {
  it('세전: 합계가 1,000원 이상이 되는 가장 작은 정수 원', () => {
    const v = breakEvenFirstPrize('pre')
    expect(expectedValueTotal(derivePrizeTable(v))).toBeGreaterThanOrEqual(1000)
    expect(expectedValueTotal(derivePrizeTable(v - 1))).toBeLessThan(1000)
    expect(v / EOK).toBeGreaterThan(45)
    expect(v / EOK).toBeLessThan(55)
  })

  it('세후: 합계가 1,000원 이상이 되는 가장 작은 정수 원', () => {
    const v = breakEvenFirstPrize('post')
    expect(expectedValueTotal(prizeTableFor(v, 'post'))).toBeGreaterThanOrEqual(1000)
    expect(expectedValueTotal(prizeTableFor(v - 1, 'post'))).toBeLessThan(1000)
    expect(v / EOK).toBeGreaterThan(65)
    expect(v / EOK).toBeLessThan(80)
  })

  it('세후: 200만 원 비과세 절벽(2·3등)에서 1등 금액이 늘어도 기대액 합계는 준다', () => {
    // 2등(= 1등/36)이 200만을 넘는 경계: 1등 72,000,000원 -> 2등 2,000,000원(비과세) / 72,000,036원 -> 2등 2,000,001원(과세)
    const beforeRank2Cliff = expectedValueTotal(prizeTableFor(72_000_000, 'post'))
    const afterRank2Cliff = expectedValueTotal(prizeTableFor(72_000_036, 'post'))
    expect(afterRank2Cliff).toBeLessThan(beforeRank2Cliff)

    // 3등(= 1등/1368)이 200만을 넘는 경계: 1등 2,736,000,000원 -> 3등 2,000,000원(비과세) / 2,736,001,368원 -> 3등 2,000,001원(과세)
    const beforeRank3Cliff = expectedValueTotal(prizeTableFor(2_736_000_000, 'post'))
    const afterRank3Cliff = expectedValueTotal(prizeTableFor(2_736_001_368, 'post'))
    expect(afterRank3Cliff).toBeLessThan(beforeRank3Cliff)
  })

  it('세후: 절벽과 분기점 아래 표본은 모두 1,000원 미만', () => {
    const breakEven = breakEvenFirstPrize('post')
    const samples = [1 * EOK, 10 * EOK, 30 * EOK, 50 * EOK, breakEven - 1]
    for (const firstPrize of samples) {
      expect(expectedValueTotal(prizeTableFor(firstPrize, 'post'))).toBeLessThan(1000)
    }
  })
})

describe('validateFirstPrizeInput', () => {
  it('하한(0.1억)은 유효', () => {
    expect(validateFirstPrizeInput(0.1)).toEqual({ ok: true, won: 10_000_000 })
  })
  it('하한 미만은 range 오류', () => {
    expect(validateFirstPrizeInput(0.09)).toEqual({ ok: false, error: { kind: 'range', value: 0.09 } })
  })
  it('상한(10,000억)은 유효', () => {
    expect(validateFirstPrizeInput(10_000)).toEqual({ ok: true, won: 1_000_000_000_000 })
  })
  it('상한 초과는 range 오류', () => {
    expect(validateFirstPrizeInput(10_000.1)).toEqual({
      ok: false,
      error: { kind: 'range', value: 10_000.1 },
    })
  })
  it('소수 둘째 자리는 precision 오류', () => {
    expect(validateFirstPrizeInput(20.55)).toEqual({
      ok: false,
      error: { kind: 'precision', value: 20.55 },
    })
  })
  it('NaN은 nan 오류', () => {
    expect(validateFirstPrizeInput(NaN)).toEqual({ ok: false, error: { kind: 'nan' } })
  })
})

describe('formatWon', () => {
  it.each<[number, string]>([
    [2_000_000_000, '20억'],
    [55_555_555, '5,555만'],
    [1_461_988, '146만'],
    [50_000, '5만'],
    [5_000, '5,000원'],
    [2_050_000_000, '20억 5,000만'],
  ])('%i -> %s', (amount, expected) => {
    expect(formatWon(amount)).toBe(expected)
  })
})

describe('formatSignedWon', () => {
  it.each<[number, string]>([
    [0, '0원'],
    [500, '+500원'],
    [-500, '-500원'],
    [50_000, '+5만'],
    [-50_000, '-5만'],
    [320_000_000, '+3억 2,000만'],
    [-320_000_000, '-3억 2,000만'],
  ])('%i -> %s', (amount, expected) => {
    expect(formatSignedWon(amount)).toBe(expected)
  })
})

describe('formatWonDecimal / formatPercentDecimal', () => {
  it('소수 첫째 자리까지 표시', () => {
    expect(formatWonDecimal(507.8313)).toBe('507.8원')
    expect(formatPercentDecimal(0.508)).toBe('50.8%')
    expect(formatPercentDecimal(1)).toBe('100.0%')
  })
})

// prize.ts가 다루지 않는 등수는 없어야 한다(engine의 Rank와 일치 확인).
describe('타입 일관성', () => {
  it('derivePrizeTable은 RANKS의 모든 등수를 채운다', () => {
    const table = derivePrizeTable(20 * EOK)
    for (const rank of RANKS as readonly Rank[]) {
      expect(table[rank]).toBeGreaterThanOrEqual(0)
    }
  })
})
