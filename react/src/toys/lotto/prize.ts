// 당첨금, 세금, 기대값, 분기점. engine과 같은 순수 함수 원칙(DOM, Math.random, 시간 의존 없음)을 따른다.
import {
  PRIZE_FIXED,
  RANKS,
  RANK_COMBINATIONS,
  TICKET_PRICE,
  TOTAL_COMBINATIONS,
} from './engine.ts'
import type { Rank } from './engine.ts'

const MAN = 10_000
const EOK = 100_000_000

const MIN_FIRST_PRIZE_EOK = 0.1
const MAX_FIRST_PRIZE_EOK = 10_000

// ---- 당첨금 표 ----

/** 1~3등 상금 풀 배분 비율(합 100%가 아니어도 된다. 서로의 비만 쓴다). */
const POOL_SHARE: Record<1 | 2 | 3, number> = { 1: 0.75, 2: 0.125, 3: 0.125 }

/**
 * 1등 금액에서 1~5등 세전 당첨금 표를 만든다.
 * 2·3등은 상금 풀 배분(POOL_SHARE)과 "당첨자 수는 확률(조합 수)대로"라는 가정을 결합해 유도한다:
 * rank_k = firstPrize × (POOL_SHARE[k] / POOL_SHARE[1]) × (RANK_COMBINATIONS[1] / RANK_COMBINATIONS[k])
 * (POOL_SHARE가 75%/12.5%/12.5%이고 RANK_COMBINATIONS가 1/6/228이면 2등 = 1등/36, 3등 = 1등/1,368.)
 * 4·5등은 engine의 고정 금액을 그대로 쓴다. 원 미만은 내린다.
 */
export function derivePrizeTable(firstPrizeWon: number): Record<Rank, number> {
  const rank2Ratio = (POOL_SHARE[2] / POOL_SHARE[1]) * (RANK_COMBINATIONS[1] / RANK_COMBINATIONS[2])
  const rank3Ratio = (POOL_SHARE[3] / POOL_SHARE[1]) * (RANK_COMBINATIONS[1] / RANK_COMBINATIONS[3])
  return {
    1: firstPrizeWon,
    2: Math.floor(firstPrizeWon * rank2Ratio),
    3: Math.floor(firstPrizeWon * rank3Ratio),
    4: PRIZE_FIXED[4],
    5: PRIZE_FIXED[5],
  }
}

// ---- 세금 (2023년 개정 기준) ----

export type TaxMode = 'pre' | 'post'

const TAX_EXEMPT_LIMIT = 2_000_000
const TICKET_COST_DEDUCTION = 1_000
const TAX_BRACKET = 300_000_000
const TAX_RATE_LOW = 0.22
const TAX_RATE_HIGH = 0.33

/**
 * 당첨금 200만 원 이하는 비과세. 초과 시 과세표준 = 당첨금 - 1,000원(구입비).
 * 과세표준 중 3억 원 이하분 22%, 3억 원 초과분 33%(지방소득세 포함). 세액은 원 단위로 내린 뒤 공제한다.
 */
export function afterTax(prizeWon: number): number {
  if (prizeWon <= TAX_EXEMPT_LIMIT) return prizeWon
  const taxBase = prizeWon - TICKET_COST_DEDUCTION
  const lowPortion = Math.min(taxBase, TAX_BRACKET)
  const highPortion = Math.max(taxBase - TAX_BRACKET, 0)
  const tax = Math.floor(lowPortion * TAX_RATE_LOW + highPortion * TAX_RATE_HIGH)
  return prizeWon - tax
}

export function toAfterTaxTable(table: Record<Rank, number>): Record<Rank, number> {
  return {
    1: afterTax(table[1]),
    2: afterTax(table[2]),
    3: afterTax(table[3]),
    4: afterTax(table[4]),
    5: afterTax(table[5]),
  }
}

/** 1등 금액(세전, 원)과 모드로부터 화면 표시용 당첨금 표를 만든다. */
export function prizeTableFor(firstPrizeWon: number, mode: TaxMode): Record<Rank, number> {
  const pretax = derivePrizeTable(firstPrizeWon)
  return mode === 'pre' ? pretax : toAfterTaxTable(pretax)
}

// ---- 기대값 ----

function expectedValueOf(rank: Rank, table: Record<Rank, number>): number {
  return (table[rank] * RANK_COMBINATIONS[rank]) / TOTAL_COMBINATIONS
}

/** 등수별 1장당 기대액(당첨금 × 확률). */
export function expectedValueTable(table: Record<Rank, number>): Record<Rank, number> {
  return {
    1: expectedValueOf(1, table),
    2: expectedValueOf(2, table),
    3: expectedValueOf(3, table),
    4: expectedValueOf(4, table),
    5: expectedValueOf(5, table),
  }
}

/** 1장당 기대액 합계. */
export function expectedValueTotal(table: Record<Rank, number>): number {
  return RANKS.reduce((sum, rank) => sum + expectedValueOf(rank, table), 0)
}

// ---- 분기점 ----

const BREAK_EVEN_TARGET = TICKET_PRICE // 1,000원
/** 이분 탐색 상한. 유효 입력 범위(최대 10,000억)보다 넉넉히 크다. */
const SEARCH_MAX_WON = 100_000 * EOK
/** 세전 닫힌 식 추정치 주변에서 정확한 정수 경계를 찾는 탐색 반경(원). */
const PRETAX_NUDGE_RADIUS = 10_000

function totalAt(firstPrizeWon: number, mode: TaxMode): number {
  return expectedValueTotal(prizeTableFor(firstPrizeWon, mode))
}

/** estimate 근방에서 "합계가 1,000원 이상이 되는 가장 작은 정수 원"을 선형 탐색으로 찾는다. */
function nearestBreakEven(estimate: number, mode: TaxMode): number {
  let candidate = Math.max(Math.round(estimate) - PRETAX_NUDGE_RADIUS, 1)
  while (totalAt(candidate, mode) < BREAK_EVEN_TARGET) candidate++
  while (candidate > 1 && totalAt(candidate - 1, mode) >= BREAK_EVEN_TARGET) candidate--
  return candidate
}

/**
 * 세전 기대값 합계는 firstPrize에 대해 사실상 선형이다: derivePrizeTable의 rank_k 유도 비율에서
 * RANK_COMBINATIONS[k]가 기대값 계산의 분자(RANK_COMBINATIONS[k])와 정확히 상쇄되어
 * (POOL_SHARE[k]/POOL_SHARE[1])만 남기 때문이다(floor로 인한 1원 미만 오차만 있다).
 * 이 닫힌 식으로 근사값을 구한 뒤, 내림 오차를 이웃 탐색으로 보정한다.
 */
function breakEvenPretax(): number {
  const fixedPart = PRIZE_FIXED[4] * RANK_COMBINATIONS[4] + PRIZE_FIXED[5] * RANK_COMBINATIONS[5]
  const poolFactor = 1 + POOL_SHARE[2] / POOL_SHARE[1] + POOL_SHARE[3] / POOL_SHARE[1]
  const coefficient = (RANK_COMBINATIONS[1] * poolFactor) / TOTAL_COMBINATIONS
  const idealEstimate = (BREAK_EVEN_TARGET - fixedPart / TOTAL_COMBINATIONS) / coefficient
  return nearestBreakEven(idealEstimate, 'pre')
}

/**
 * 세후 기대값 합계는 firstPrize에 대해 전역적으로 단조 증가가 아니다. 200만 원 비과세 절벽
 * (200만 이하는 무세, 초과 시 전액 과세) 때문에 rank2가 200만을 넘는 지점(약 0.72억)과 rank3가
 * 200만을 넘는 지점(약 27.36억)에서 합계가 국소적으로 줄어든다. 하지만 두 절벽 모두 분기점
 * (약 70억대)보다 한참 아래이고, 27.36억을 넘어서면 더 이상 절벽이 없어 그 구간은 연속적으로
 * 단조 증가한다. 즉 절벽 구간의 합계는 1,000원에 한참 못 미치므로 "1,000원을 넘는 지점이
 * 정확히 하나"라는 성질이 유지되고, 정수 원 단위 이분 탐색으로 그 지점을 안전하게 찾을 수 있다.
 */
function breakEvenAfterTax(): number {
  let low = 0 // totalAt(low, 'post') < target
  let high = SEARCH_MAX_WON // totalAt(high, 'post') >= target
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2)
    if (totalAt(mid, 'post') >= BREAK_EVEN_TARGET) {
      high = mid
    } else {
      low = mid
    }
  }
  return high
}

/**
 * 1장당 기대 환급액(모든 등수 합)이 1,000원이 되는 1등 금액(세전 입력 기준, 원)을 찾는다.
 * 정밀도는 원 단위: "합계가 1,000원 이상이 되는 가장 작은 정수 원"을 반환한다.
 */
export function breakEvenFirstPrize(mode: TaxMode): number {
  return mode === 'pre' ? breakEvenPretax() : breakEvenAfterTax()
}

// ---- 입력 검증 ----

export type FirstPrizeError =
  | { kind: 'nan' }
  | { kind: 'range'; value: number }
  | { kind: 'precision'; value: number }

export type FirstPrizeValidation =
  | { ok: true; won: number }
  | { ok: false; error: FirstPrizeError }

/**
 * 1등 금액 입력(억 단위, 소수 첫째 자리까지, 0.1~10,000)을 검사한다.
 * 검사 순서: 숫자 여부 → 범위 → 소수 자릿수. `validateTicket`과 같은 패턴(예외 대신 값).
 * 성공하면 원 단위 정수를 돌려준다.
 */
export function validateFirstPrizeInput(amountInEok: number): FirstPrizeValidation {
  if (!Number.isFinite(amountInEok)) return { ok: false, error: { kind: 'nan' } }
  if (amountInEok < MIN_FIRST_PRIZE_EOK || amountInEok > MAX_FIRST_PRIZE_EOK) {
    return { ok: false, error: { kind: 'range', value: amountInEok } }
  }
  const tenths = amountInEok * 10
  if (Math.abs(tenths - Math.round(tenths)) > 1e-9) {
    return { ok: false, error: { kind: 'precision', value: amountInEok } }
  }
  return { ok: true, won: Math.round(amountInEok * EOK) }
}

// ---- 금액 표시 ----

/**
 * 억/만 단위로 읽기 쉽게 내림 표시한다(당첨금 표, 분기점 1등 금액처럼 큰 금액용).
 * 1억 이상은 "N억"(만 단위 나머지가 있으면 "N억 M만"), 1만~1억 미만은 "M만", 1만 미만은 "원" 그대로.
 */
export function formatWon(amountWon: number): string {
  if (amountWon < MAN) return `${amountWon.toLocaleString('ko-KR')}원`
  if (amountWon < EOK) {
    return `${Math.floor(amountWon / MAN).toLocaleString('ko-KR')}만`
  }
  const eok = Math.floor(amountWon / EOK)
  const manRemainder = Math.floor((amountWon % EOK) / MAN)
  return manRemainder > 0
    ? `${eok.toLocaleString('ko-KR')}억 ${manRemainder.toLocaleString('ko-KR')}만`
    : `${eok.toLocaleString('ko-KR')}억`
}

/** 1장당 기대액처럼 1원 미만이 흔한 작은 금액을 소수 첫째 자리까지 표시한다(억/만 내림은 손실이 큼). */
export function formatWonDecimal(amountWon: number): string {
  return `${amountWon.toFixed(1)}원`
}

/** 0~1 비율을 백분율로, 소수 첫째 자리까지 표시한다. */
export function formatPercentDecimal(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}
