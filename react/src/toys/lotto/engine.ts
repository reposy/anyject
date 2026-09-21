// 로또 6/45 engine. 순수 함수만 둔다(DOM, Math.random, 시간 의존 없음).

export type Rank = 1 | 2 | 3 | 4 | 5
export type TargetRank = 1 | 2 | 3 | 4

/** 서로 다른 6개, 오름차순. 범위(1~45)와 중복은 `validateTicket`이 보장한다. */
export type Ticket = readonly number[]
export type Draw = { main: Ticket; bonus: number }

/** [0, 1) 난수 생성기. engine은 항상 주입받아 쓴다. */
export type Rng = () => number

export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5]

const MAX_NUMBER = 45
const TICKET_SIZE = 6

export const TICKET_PRICE = 1000
export const RANK_COMBINATIONS: Record<Rank, number> = {
  1: 1,
  2: 6,
  3: 228,
  4: 11_115,
  5: 182_780,
}
export const TOTAL_COMBINATIONS = 8_145_060

/** 4·5등만 고정 금액이다. 1~3등은 회차마다 달라 engine에 두지 않는다. */
export const PRIZE_FIXED = { 4: 50_000, 5: 5_000 } as const

const WEEKS_PER_YEAR = 52

// ---- 번호 생성 ----

// 1..45 조회 표. 읽기 전용으로만 쓴다(가변 버퍼는 각 호출 안에서 만든다).
const IDENTITY = /* @__PURE__ */ Uint8Array.from({ length: MAX_NUMBER }, (_, i) => i + 1)

/**
 * pool[0..count)에 1~45 중 중복 없는 count개를 남긴다(부분 Fisher–Yates, rng를 count번 호출).
 * 호출마다 pool을 1..45로 되돌린 뒤 시작하므로, 재사용한 pool로도 새 풀과 같은 결과가 나온다.
 */
function sampleInto(rng: Rng, pool: Uint8Array, count: number): void {
  pool.set(IDENTITY)
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (MAX_NUMBER - i))
    const picked = pool[j]
    pool[j] = pool[i]
    pool[i] = picked
  }
}

/** 1~45에서 중복 없이 count개를 뽑는다(부분 Fisher–Yates, rng를 count번 호출). */
export function pickDistinct(rng: Rng, count: number): number[] {
  const pool = new Uint8Array(MAX_NUMBER)
  sampleInto(rng, pool, count)
  return Array.from(pool.subarray(0, count))
}

const ascending = (a: number, b: number) => a - b

/** buffer[0..count)를 오름차순 배열로 복사한다. */
function sortedCopy(buffer: Uint8Array, count: number): number[] {
  return Array.from(buffer.subarray(0, count)).sort(ascending)
}

export function generateTicket(rng: Rng): Ticket {
  return pickDistinct(rng, TICKET_SIZE).sort(ascending)
}

export function drawNumbers(rng: Rng): Draw {
  const picked = pickDistinct(rng, TICKET_SIZE + 1)
  return {
    main: picked.slice(0, TICKET_SIZE).sort(ascending),
    bonus: picked[TICKET_SIZE],
  }
}

// ---- 티켓 검증 ----

export type TicketError =
  | { kind: 'count'; actual: number }
  | { kind: 'range'; values: number[] }
  | { kind: 'duplicate'; values: number[] }

export type TicketValidation =
  | { ok: true; ticket: Ticket }
  | { ok: false; error: TicketError }

/** 검사 순서: 개수 → 범위(정수가 아닌 값 포함) → 중복. 성공하면 정렬된 복사본을 돌려준다. */
export function validateTicket(numbers: readonly number[]): TicketValidation {
  if (numbers.length !== TICKET_SIZE) {
    return { ok: false, error: { kind: 'count', actual: numbers.length } }
  }
  const outOfRange = numbers.filter(
    (n) => !Number.isInteger(n) || n < 1 || n > MAX_NUMBER,
  )
  if (outOfRange.length > 0) {
    return { ok: false, error: { kind: 'range', values: outOfRange } }
  }
  const duplicates = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))]
  if (duplicates.length > 0) {
    return { ok: false, error: { kind: 'duplicate', values: duplicates } }
  }
  return { ok: true, ticket: [...numbers].sort(ascending) }
}

// ---- 등수 판정 ----

const MARK_MAIN = 1
const MARK_BONUS = 2

/** marks[번호]가 본번호는 MARK_MAIN, 보너스는 MARK_BONUS인 조회 표로 등수를 판정한다. 미당첨은 null. */
function judge(ticket: ArrayLike<number>, marks: Uint8Array): Rank | null {
  let matches = 0
  let bonusHit = false
  for (let i = 0; i < ticket.length; i++) {
    const mark = marks[ticket[i]]
    if (mark === MARK_MAIN) matches++
    else if (mark === MARK_BONUS) bonusHit = true
  }
  switch (matches) {
    case 6:
      return 1
    case 5:
      return bonusHit ? 2 : 3
    case 4:
      return 4
    case 3:
      return 5
    default:
      return null
  }
}

/** 미당첨은 null. */
export function rankOf(ticket: Ticket, draw: Draw): Rank | null {
  const marks = new Uint8Array(MAX_NUMBER + 1)
  for (const n of draw.main) marks[n] = MARK_MAIN
  marks[draw.bonus] = MARK_BONUS
  return judge(ticket, marks)
}

// ---- 확률과 기대값 ----

/** 목표 등수 이상에 당첨될 확률. */
export function probabilityAtLeast(target: TargetRank): number {
  let combinations = 0
  for (const rank of RANKS) {
    if (rank <= target) combinations += RANK_COMBINATIONS[rank]
  }
  return combinations / TOTAL_COMBINATIONS
}

export function expectedAttempts(target: TargetRank): number {
  return 1 / probabilityAtLeast(target)
}

export function expectedCost(target: TargetRank): number {
  return expectedAttempts(target) * TICKET_PRICE
}

// ---- 시뮬레이션 ----

export type TicketMode = { kind: 'auto' } | { kind: 'fixed'; ticket: Ticket }

export type SimConfig = {
  target: TargetRank
  /** null이면 무한. 양의 정수여야 한다(검증은 `validateConfig`). */
  maxAttempts: number | null
  ticket: TicketMode
}

export type ConfigError =
  | { kind: 'target'; value: unknown }
  | { kind: 'maxAttempts'; value: unknown }
  | { kind: 'ticket'; error: TicketError }

export type ConfigValidation =
  | { ok: true; config: SimConfig }
  | { ok: false; error: ConfigError }

/**
 * 검사 순서: target(1~4 정수) → maxAttempts(null 또는 1 이상의 안전 정수) → 고정 티켓(`validateTicket`).
 * 첫 오류만 돌려준다. 성공하면 티켓이 정렬된 새 config를 돌려준다(입력은 변경하지 않음).
 */
export function validateConfig(config: SimConfig): ConfigValidation {
  const { target, maxAttempts } = config
  if (!Number.isInteger(target) || target < 1 || target > 4) {
    return { ok: false, error: { kind: 'target', value: target } }
  }
  if (maxAttempts !== null && !(Number.isSafeInteger(maxAttempts) && maxAttempts >= 1)) {
    return { ok: false, error: { kind: 'maxAttempts', value: maxAttempts } }
  }
  if (config.ticket.kind === 'auto') {
    return { ok: true, config: { target, maxAttempts, ticket: { kind: 'auto' } } }
  }
  const ticket = validateTicket(config.ticket.ticket)
  if (!ticket.ok) return { ok: false, error: { kind: 'ticket', error: ticket.error } }
  return {
    ok: true,
    config: { target, maxAttempts, ticket: { kind: 'fixed', ticket: ticket.ticket } },
  }
}

export type StopReason = 'target' | 'limit'

/** 직렬화 가능한 plain object(postMessage 전송 대상). */
export type SimState = {
  attempts: number
  wins: Record<Rank, number>
  /** 정지 전에는 null. 정지 시점의 추첨과 티켓을 함께 담는다. */
  stop: null | { reason: StopReason; draw: Draw; ticket: Ticket }
}

export function createInitialState(): SimState {
  return { attempts: 0, wins: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, stop: null }
}

/**
 * 최대 batchSize회 시도한 새 상태를 반환한다(입력 상태는 변경하지 않음).
 * 시도마다 rng 소비량이 일정(자동: 티켓 6 + 추첨 7, 고정: 추첨 7)하므로
 * 같은 rng 순서에서는 배치를 어떻게 나눠도 결과가 같다.
 * 이미 정지된 상태(또는 batchSize <= 0)는 같은 상태를 그대로 반환한다.
 * 번호 풀과 조회 표는 이 호출 안에서만 만들어 시도마다 재사용한다(외부에서는 순수 함수).
 * 정렬과 배열 생성은 정지 시점의 티켓/추첨 저장에만 한다.
 */
export function runBatch(
  state: SimState,
  config: SimConfig,
  batchSize: number,
  rng: Rng,
): SimState {
  if (state.stop !== null || batchSize <= 0) return state

  let attempts = state.attempts
  const wins = { ...state.wins }
  let stop: SimState['stop'] = null

  const pool = new Uint8Array(MAX_NUMBER)
  const marks = new Uint8Array(MAX_NUMBER + 1)
  const fixedTicket = config.ticket.kind === 'fixed' ? config.ticket.ticket : null
  const autoTicket = new Uint8Array(TICKET_SIZE)
  const ticketNumbers: ArrayLike<number> = fixedTicket ?? autoTicket

  for (let i = 0; i < batchSize && stop === null; i++) {
    if (fixedTicket === null) {
      sampleInto(rng, pool, TICKET_SIZE)
      for (let k = 0; k < TICKET_SIZE; k++) autoTicket[k] = pool[k]
    }
    sampleInto(rng, pool, TICKET_SIZE + 1)
    for (let k = 0; k < TICKET_SIZE; k++) marks[pool[k]] = MARK_MAIN
    marks[pool[TICKET_SIZE]] = MARK_BONUS

    const rank = judge(ticketNumbers, marks)
    attempts++
    if (rank !== null) wins[rank]++

    let reason: StopReason | null = null
    if (rank !== null && rank <= config.target) {
      reason = 'target'
    } else if (config.maxAttempts !== null && attempts >= config.maxAttempts) {
      reason = 'limit'
    }
    if (reason !== null) {
      stop = {
        reason,
        draw: { main: sortedCopy(pool, TICKET_SIZE), bonus: pool[TICKET_SIZE] },
        ticket: fixedTicket ?? sortedCopy(autoTicket, TICKET_SIZE),
      }
    }

    for (let k = 0; k <= TICKET_SIZE; k++) marks[pool[k]] = 0
  }

  return { attempts, wins, stop }
}

// ---- 요약 ----

export type Summary = {
  cost: number
  winnings: number
  /** cost - winnings. 당첨금이 비용을 넘으면 음수(순이익). */
  netLoss: number
  /** 매주 1장씩 샀다면 걸리는 햇수. */
  years: number
}

export function summarize(state: SimState, prizes: Record<Rank, number>): Summary {
  const cost = state.attempts * TICKET_PRICE
  const winnings = RANKS.reduce((sum, rank) => sum + state.wins[rank] * prizes[rank], 0)
  return {
    cost,
    winnings,
    netLoss: cost - winnings,
    years: state.attempts / WEEKS_PER_YEAR,
  }
}
