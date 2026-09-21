import { describe, expect, it, vi } from 'vitest'
import {
  PRIZE_FIXED,
  RANKS,
  RANK_COMBINATIONS,
  TICKET_PRICE,
  TOTAL_COMBINATIONS,
  createInitialState,
  drawNumbers,
  expectedAttempts,
  expectedCost,
  generateTicket,
  pickDistinct,
  probabilityAtLeast,
  rankOf,
  runBatch,
  summarize,
  validateTicket,
} from './engine.ts'
import type { Rng, SimConfig, SimState, TargetRank, Ticket } from './engine.ts'

// mulberry32: 시드가 같으면 같은 수열을 내는 [0, 1) 난수 생성기.
function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 항상 0이면 부분 Fisher–Yates가 1, 2, 3, ...을 차례로 뽑는다.
// 따라서 추첨은 본번호 1~6, 보너스 7로 고정된다.
const zeroRng: Rng = () => 0
const DRAW = { main: [1, 2, 3, 4, 5, 6], bonus: 7 }

const CALLS_PER_AUTO_ATTEMPT = 13 // 티켓 6 + 추첨 7
const CALLS_PER_FIXED_ATTEMPT = 7

function countingRng(rng: Rng) {
  let calls = 0
  return {
    rng: () => {
      calls++
      return rng()
    },
    get calls() {
      return calls
    },
  }
}

function choose(n: number, k: number): number {
  let result = 1
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i
  return Math.round(result)
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const fixed = (ticket: Ticket): SimConfig['ticket'] => ({ kind: 'fixed', ticket })
const NEVER_WINS: Ticket = [40, 41, 42, 43, 44, 45] // zeroRng 추첨과 겹치지 않음

describe('rankOf', () => {
  const rank = (ticket: Ticket, bonus = 7) => rankOf(ticket, { main: DRAW.main, bonus })

  it('6개 일치는 1등', () => {
    expect(rank([1, 2, 3, 4, 5, 6])).toBe(1)
  })
  it('5개 + 보너스는 2등', () => {
    expect(rank([1, 2, 3, 4, 5, 7])).toBe(2)
  })
  it('5개 일치(보너스 불일치)는 3등', () => {
    expect(rank([1, 2, 3, 4, 5, 40])).toBe(3)
  })
  it('4개 일치는 4등', () => {
    expect(rank([1, 2, 3, 4, 40, 41])).toBe(4)
  })
  it('4개 + 보너스는 여전히 4등', () => {
    expect(rank([1, 2, 3, 4, 7, 41])).toBe(4)
  })
  it('3개 일치는 5등', () => {
    expect(rank([1, 2, 3, 40, 41, 42])).toBe(5)
  })
  it('2개 + 보너스는 미당첨', () => {
    expect(rank([1, 2, 7, 40, 41, 42])).toBeNull()
  })
  it('0~2개 일치는 미당첨', () => {
    expect(rank([1, 2, 40, 41, 42, 43])).toBeNull()
    expect(rank([1, 40, 41, 42, 43, 44])).toBeNull()
    expect(rank(NEVER_WINS)).toBeNull()
  })
})

describe('번호 생성', () => {
  const seeds = [1, 2, 3, 42, 12345, 0xdeadbeef]

  it.each(seeds)('pickDistinct: 개수, 범위, 중복 없음 (seed %i)', (seed) => {
    const rng = seeded(seed)
    for (let i = 0; i < 200; i++) {
      const picked = pickDistinct(rng, 7)
      expect(picked).toHaveLength(7)
      expect(new Set(picked).size).toBe(7)
      expect(picked.every((n) => Number.isInteger(n) && n >= 1 && n <= 45)).toBe(true)
    }
  })

  it('45개를 모두 뽑으면 1~45의 순열', () => {
    const picked = pickDistinct(seeded(7), 45)
    expect([...picked].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 45 }, (_, i) => i + 1),
    )
  })

  it('rng가 1에 가까워도 범위를 벗어나지 않는다', () => {
    const picked = pickDistinct(() => 0.9999999999999999, 7)
    expect(new Set(picked).size).toBe(7)
    expect(picked.every((n) => n >= 1 && n <= 45)).toBe(true)
  })

  it('count번만 rng를 호출한다', () => {
    const counter = countingRng(seeded(1))
    pickDistinct(counter.rng, 6)
    expect(counter.calls).toBe(6)
  })

  it.each(seeds)('generateTicket: 서로 다른 6개, 오름차순 (seed %i)', (seed) => {
    const ticket = generateTicket(seeded(seed))
    expect(ticket).toHaveLength(6)
    expect(validateTicket(ticket)).toEqual({ ok: true, ticket })
    expect(ticket).toEqual([...ticket].sort((a, b) => a - b))
  })

  it.each(seeds)('drawNumbers: 본번호 6개 + 보너스 1개, 모두 다름 (seed %i)', (seed) => {
    const draw = drawNumbers(seeded(seed))
    expect(draw.main).toHaveLength(6)
    expect(new Set([...draw.main, draw.bonus]).size).toBe(7)
    expect(validateTicket(draw.main).ok).toBe(true)
    expect(draw.bonus).toBeGreaterThanOrEqual(1)
    expect(draw.bonus).toBeLessThanOrEqual(45)
  })

  it('같은 시드는 같은 결과', () => {
    expect(drawNumbers(seeded(9))).toEqual(drawNumbers(seeded(9)))
  })

  it('Math.random을 호출하지 않는다', () => {
    const spy = vi.spyOn(Math, 'random')
    const rng = seeded(5)
    generateTicket(rng)
    drawNumbers(rng)
    runBatch(createInitialState(), { target: 1, maxAttempts: 50, ticket: { kind: 'auto' } }, 50, rng)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('validateTicket', () => {
  it('정상 입력은 정렬된 복사본을 돌려준다', () => {
    const input = [45, 1, 30, 7, 22, 3]
    const result = validateTicket(input)
    expect(result).toEqual({ ok: true, ticket: [1, 3, 7, 22, 30, 45] })
    expect(input).toEqual([45, 1, 30, 7, 22, 3])
  })

  it('범위 밖 값(0, 46)을 거부한다', () => {
    expect(validateTicket([0, 1, 2, 3, 4, 5])).toEqual({
      ok: false,
      error: { kind: 'range', values: [0] },
    })
    expect(validateTicket([1, 2, 3, 4, 5, 46])).toEqual({
      ok: false,
      error: { kind: 'range', values: [46] },
    })
  })

  it('정수가 아닌 값과 NaN은 범위 오류', () => {
    expect(validateTicket([1, 2, 3, 4, 5, 6.5])).toMatchObject({
      ok: false,
      error: { kind: 'range' },
    })
    expect(validateTicket([1, 2, 3, 4, 5, NaN])).toMatchObject({
      ok: false,
      error: { kind: 'range' },
    })
  })

  it('중복을 거부한다', () => {
    expect(validateTicket([1, 1, 2, 3, 4, 5])).toEqual({
      ok: false,
      error: { kind: 'duplicate', values: [1] },
    })
  })

  it('개수가 모자라거나 넘치면 거부한다', () => {
    expect(validateTicket([1, 2, 3, 4, 5])).toEqual({
      ok: false,
      error: { kind: 'count', actual: 5 },
    })
    expect(validateTicket([1, 2, 3, 4, 5, 6, 7])).toEqual({
      ok: false,
      error: { kind: 'count', actual: 7 },
    })
    expect(validateTicket([])).toEqual({ ok: false, error: { kind: 'count', actual: 0 } })
  })

  it('개수 오류가 범위/중복 오류보다 우선한다', () => {
    expect(validateTicket([0, 0, 99])).toMatchObject({ error: { kind: 'count' } })
  })

  it('범위 오류가 중복 오류보다 우선한다', () => {
    expect(validateTicket([0, 0, 1, 2, 3, 4])).toMatchObject({ error: { kind: 'range' } })
  })
})

describe('확률과 기대값', () => {
  it('등수별 경우의 수 상수', () => {
    expect(RANK_COMBINATIONS).toEqual({ 1: 1, 2: 6, 3: 228, 4: 11115, 5: 182780 })
    expect(TOTAL_COMBINATIONS).toBe(8145060)
  })

  it('경우의 수가 조합 공식과 일치한다', () => {
    expect(TOTAL_COMBINATIONS).toBe(choose(45, 6))
    expect(RANK_COMBINATIONS[1]).toBe(choose(6, 6))
    expect(RANK_COMBINATIONS[2]).toBe(choose(6, 5) * choose(1, 1))
    expect(RANK_COMBINATIONS[3]).toBe(choose(6, 5) * choose(38, 1))
    expect(RANK_COMBINATIONS[4]).toBe(choose(6, 4) * choose(39, 2))
    expect(RANK_COMBINATIONS[5]).toBe(choose(6, 3) * choose(39, 3))
  })

  it.each<[TargetRank, number]>([
    [1, 8145060],
    [2, 8145060 / 7],
    [3, 8145060 / 235],
    [4, 8145060 / 11350],
  ])('목표 %i등 이상의 기대 시도 횟수', (target, expected) => {
    expect(expectedAttempts(target)).toBeCloseTo(expected, 6)
    expect(probabilityAtLeast(target)).toBeCloseTo(1 / expected, 12)
    expect(expectedCost(target)).toBeCloseTo(expected * TICKET_PRICE, 3)
  })

  it('시도당 비용은 1,000원', () => {
    expect(TICKET_PRICE).toBe(1000)
  })
})

describe('runBatch', () => {
  const auto: SimConfig['ticket'] = { kind: 'auto' }

  it('초기 상태', () => {
    expect(createInitialState()).toEqual({
      attempts: 0,
      wins: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      stop: null,
    })
  })

  it('목표 등수에 도달하면 정지하고 추첨과 티켓을 담는다 (고정)', () => {
    const ticket = [1, 2, 3, 4, 5, 6]
    const next = runBatch(
      createInitialState(),
      { target: 1, maxAttempts: null, ticket: fixed(ticket) },
      1000,
      zeroRng,
    )
    expect(next.attempts).toBe(1)
    expect(next.wins[1]).toBe(1)
    expect(next.stop).toEqual({ reason: 'target', draw: DRAW, ticket })
  })

  it('목표 등수에 도달하면 배치 중간에서도 정지한다 (자동)', () => {
    // 자동 티켓과 추첨이 모두 1~6이 되어 첫 시도에 1등
    const next = runBatch(
      createInitialState(),
      { target: 1, maxAttempts: null, ticket: auto },
      1000,
      zeroRng,
    )
    expect(next.attempts).toBe(1)
    expect(next.stop).toEqual({ reason: 'target', draw: DRAW, ticket: [1, 2, 3, 4, 5, 6] })
  })

  it('목표보다 낮은 등수는 집계만 하고 계속 진행한다', () => {
    const next = runBatch(
      createInitialState(),
      { target: 4, maxAttempts: null, ticket: fixed([1, 2, 3, 40, 41, 42]) },
      10,
      zeroRng,
    )
    expect(next.attempts).toBe(10)
    expect(next.wins[5]).toBe(10)
    expect(next.stop).toBeNull()
  })

  it('최대 횟수에 도달하면 limit으로 정지한다', () => {
    const config: SimConfig = { target: 1, maxAttempts: 5, ticket: fixed(NEVER_WINS) }
    const next = runBatch(createInitialState(), config, 100, zeroRng)
    expect(next.attempts).toBe(5)
    expect(next.stop).toEqual({ reason: 'limit', draw: DRAW, ticket: NEVER_WINS })
  })

  it('배치가 최대 횟수보다 작으면 정지하지 않고, 이어서 실행하면 limit에서 멈춘다', () => {
    const config: SimConfig = { target: 1, maxAttempts: 5, ticket: fixed(NEVER_WINS) }
    const first = runBatch(createInitialState(), config, 3, zeroRng)
    expect(first.attempts).toBe(3)
    expect(first.stop).toBeNull()
    const second = runBatch(first, config, 3, zeroRng)
    expect(second.attempts).toBe(5)
    expect(second.stop?.reason).toBe('limit')
  })

  it('마지막 시도에서 target과 limit이 겹치면 target이 우선한다', () => {
    const next = runBatch(
      createInitialState(),
      { target: 1, maxAttempts: 1, ticket: fixed([1, 2, 3, 4, 5, 6]) },
      10,
      zeroRng,
    )
    expect(next.attempts).toBe(1)
    expect(next.stop?.reason).toBe('target')
  })

  it('낮은 등수 목표에서도 겹치면 target이 우선한다', () => {
    const next = runBatch(
      createInitialState(),
      { target: 4, maxAttempts: 1, ticket: fixed([1, 2, 3, 4, 40, 41]) },
      10,
      zeroRng,
    )
    expect(next.stop?.reason).toBe('target')
    expect(next.wins[4]).toBe(1)
  })

  it('maxAttempts가 null이면 limit으로 정지하지 않는다', () => {
    const next = runBatch(
      createInitialState(),
      { target: 1, maxAttempts: null, ticket: fixed(NEVER_WINS) },
      5000,
      zeroRng,
    )
    expect(next.attempts).toBe(5000)
    expect(next.stop).toBeNull()
  })

  it('정지된 상태로 호출하면 변경 없이 같은 상태를 돌려주고 rng도 쓰지 않는다', () => {
    const config: SimConfig = { target: 1, maxAttempts: 2, ticket: fixed(NEVER_WINS) }
    const stopped = runBatch(createInitialState(), config, 10, zeroRng)
    expect(stopped.stop).not.toBeNull()
    const counter = countingRng(zeroRng)
    const again = runBatch(stopped, config, 10, counter.rng)
    expect(again).toBe(stopped)
    expect(counter.calls).toBe(0)
  })

  it('batchSize가 0 이하이면 상태를 그대로 돌려준다', () => {
    const state = createInitialState()
    expect(runBatch(state, { target: 1, maxAttempts: null, ticket: auto }, 0, zeroRng)).toBe(state)
  })

  it('입력 상태를 변경하지 않는다', () => {
    const state = deepFreeze<SimState>({
      attempts: 4,
      wins: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
      stop: null,
    })
    const snapshot = structuredClone(state)
    const next = runBatch(
      state,
      { target: 1, maxAttempts: null, ticket: fixed([1, 2, 3, 40, 41, 42]) },
      3,
      zeroRng,
    )
    expect(state).toEqual(snapshot)
    expect(next).not.toBe(state)
    expect(next.wins).not.toBe(state.wins)
    expect(next.attempts).toBe(7)
    expect(next.wins[5]).toBe(4)
  })

  it('상태는 JSON 왕복 후에도 같다(직렬화 가능)', () => {
    const state = runBatch(
      createInitialState(),
      { target: 4, maxAttempts: 2000, ticket: auto },
      2000,
      seeded(11),
    )
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
    expect(structuredClone(state)).toEqual(state)
  })

  it('시도당 rng 소비량은 자동 13회(티켓 6 + 추첨 7), 고정 7회', () => {
    const fixedCounter = countingRng(zeroRng)
    runBatch(
      createInitialState(),
      { target: 1, maxAttempts: null, ticket: fixed(NEVER_WINS) },
      4,
      fixedCounter.rng,
    )
    expect(fixedCounter.calls).toBe(4 * CALLS_PER_FIXED_ATTEMPT)

    const counter = countingRng(seeded(3))
    const state = runBatch(
      createInitialState(),
      { target: 1, maxAttempts: 3, ticket: auto },
      3,
      counter.rng,
    )
    expect(state.attempts).toBe(3)
    expect(counter.calls).toBe(3 * CALLS_PER_AUTO_ATTEMPT)
  })
})

describe('배치 불변성', () => {
  type Case = { name: string; config: SimConfig; total: number; batches: number }
  const cases: Case[] = [
    {
      name: '자동, 정지 없음',
      config: { target: 1, maxAttempts: null, ticket: { kind: 'auto' } },
      total: 600,
      batches: 6,
    },
    {
      name: '자동, 4등 목표 — 중간 정지 가능',
      config: { target: 4, maxAttempts: null, ticket: { kind: 'auto' } },
      total: 20000,
      batches: 8,
    },
    {
      name: '고정, 낮은 목표라도 limit에서 정지',
      config: { target: 1, maxAttempts: 700, ticket: fixed([3, 9, 17, 25, 33, 41]) },
      total: 1000,
      batches: 5,
    },
    {
      name: '자동, limit이 배치 경계 중간',
      config: { target: 1, maxAttempts: 333, ticket: { kind: 'auto' } },
      total: 1000,
      batches: 4,
    },
  ]
  const seeds = [1, 2, 3, 99]

  for (const { name, config, total, batches } of cases) {
    it.each(seeds)(`${name}: N회 1배치 = (N/k)회 k배치 (seed %i)`, (seed) => {
      const oneShot = runBatch(createInitialState(), config, total, seeded(seed))

      const rng = seeded(seed)
      let split = createInitialState()
      for (let i = 0; i < batches; i++) {
        split = runBatch(split, config, total / batches, rng)
      }
      expect(split).toEqual(oneShot)
    })
  }

  it('중간 정지 사례가 실제로 포함된다', () => {
    const config: SimConfig = { target: 4, maxAttempts: null, ticket: { kind: 'auto' } }
    const results = [1, 2, 3, 99].map((seed) =>
      runBatch(createInitialState(), config, 20000, seeded(seed)),
    )
    expect(results.some((r) => r.stop?.reason === 'target' && r.attempts < 20000)).toBe(true)
  })
})

describe('summarize', () => {
  const prizes = { 1: 2_000_000_000, 2: 50_000_000, 3: 1_500_000, ...PRIZE_FIXED }

  it('4·5등 고정 금액', () => {
    expect(PRIZE_FIXED).toEqual({ 4: 50000, 5: 5000 })
  })

  it('비용, 당첨금, 순손실, 햇수', () => {
    const state: SimState = {
      attempts: 5200,
      wins: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 10 },
      stop: null,
    }
    expect(summarize(state, prizes)).toEqual({
      cost: 5_200_000,
      winnings: 1_500_000 + 2 * 50_000 + 10 * 5_000,
      netLoss: 5_200_000 - 1_650_000,
      years: 100,
    })
  })

  it('시도 수 ÷ 52로 햇수를 계산한다', () => {
    const state = { ...createInitialState(), attempts: 26 }
    expect(summarize(state, prizes).years).toBe(0.5)
  })

  it('당첨이 없으면 순손실은 비용과 같다', () => {
    const state = { ...createInitialState(), attempts: 10 }
    expect(summarize(state, prizes)).toEqual({
      cost: 10_000,
      winnings: 0,
      netLoss: 10_000,
      years: 10 / 52,
    })
  })

  it('당첨금이 비용을 넘으면 순손실은 음수', () => {
    const state: SimState = {
      attempts: 100,
      wins: { 1: 1, 2: 0, 3: 0, 4: 0, 5: 0 },
      stop: null,
    }
    expect(summarize(state, prizes).netLoss).toBe(100_000 - 2_000_000_000)
  })

  it('당첨금 표는 인자로 받는다', () => {
    const state: SimState = {
      attempts: 1,
      wins: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
      stop: null,
    }
    expect(summarize(state, { ...prizes, 3: 1 }).winnings).toBe(1)
    expect(summarize(state, { ...prizes, 3: 7 }).winnings).toBe(7)
  })

  it('RANKS는 1~5등을 모두 포함한다', () => {
    expect(RANKS).toEqual([1, 2, 3, 4, 5])
  })
})
