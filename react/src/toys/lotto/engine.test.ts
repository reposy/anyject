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
  validateConfig,
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

describe('validateConfig', () => {
  const base: SimConfig = { target: 1, maxAttempts: null, ticket: { kind: 'auto' } }
  const withTarget = (target: number) => ({ ...base, target }) as SimConfig
  const withMax = (maxAttempts: number | null): SimConfig => ({ ...base, maxAttempts })

  it('정상 설정(자동, 무한)은 그대로 통과한다', () => {
    expect(validateConfig(base)).toEqual({ ok: true, config: base })
  })

  it.each([1, 2, 3, 4])('목표 %i등을 허용한다', (target) => {
    expect(validateConfig(withTarget(target)).ok).toBe(true)
  })

  it.each([0, 5, -1, 2.5, NaN, Infinity])('목표 %s를 거부한다', (target) => {
    expect(validateConfig(withTarget(target))).toEqual({
      ok: false,
      error: { kind: 'target', value: target },
    })
  })

  it.each([1, 1000, Number.MAX_SAFE_INTEGER])('maxAttempts %i를 허용한다', (max) => {
    expect(validateConfig(withMax(max))).toEqual({ ok: true, config: withMax(max) })
  })

  it.each([0, -1, 0.5, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'maxAttempts %s를 거부한다',
    (max) => {
      expect(validateConfig(withMax(max))).toEqual({
        ok: false,
        error: { kind: 'maxAttempts', value: max },
      })
    },
  )

  it('고정 티켓은 validateTicket 규칙을 따르고 정렬된 복사본으로 돌려준다', () => {
    const input = [45, 1, 30, 7, 22, 3]
    const result = validateConfig({ ...base, ticket: fixed(input) })
    expect(result).toEqual({
      ok: true,
      config: { ...base, ticket: fixed([1, 3, 7, 22, 30, 45]) },
    })
    expect(input).toEqual([45, 1, 30, 7, 22, 3])
  })

  it.each<[string, number[], object]>([
    ['개수', [1, 2, 3], { kind: 'count', actual: 3 }],
    ['범위', [0, 1, 2, 3, 4, 5], { kind: 'range', values: [0] }],
    ['중복', [1, 1, 2, 3, 4, 5], { kind: 'duplicate', values: [1] }],
  ])('고정 티켓 %s 오류를 ticket 오류로 감싼다', (_, numbers, error) => {
    expect(validateConfig({ ...base, ticket: fixed(numbers) })).toEqual({
      ok: false,
      error: { kind: 'ticket', error },
    })
  })

  it('자동 방식은 티켓을 검사하지 않는다', () => {
    expect(validateConfig(withMax(5)).ok).toBe(true)
  })

  it('오류 우선순위: target → maxAttempts → 티켓', () => {
    const bad: SimConfig = { target: 9 as TargetRank, maxAttempts: 0, ticket: fixed([1]) }
    expect(validateConfig(bad)).toMatchObject({ error: { kind: 'target' } })
    expect(validateConfig({ ...bad, target: 1 })).toMatchObject({ error: { kind: 'maxAttempts' } })
    expect(validateConfig({ ...bad, target: 1, maxAttempts: 1 })).toMatchObject({
      error: { kind: 'ticket' },
    })
  })

  it('입력 설정을 변경하지 않는다', () => {
    const config = deepFreeze<SimConfig>({
      target: 2,
      maxAttempts: 10,
      ticket: { kind: 'fixed', ticket: [6, 5, 4, 3, 2, 1] },
    })
    const snapshot = structuredClone(config)
    validateConfig(config)
    expect(config).toEqual(snapshot)
  })

  it('통과한 설정은 runBatch에 바로 쓸 수 있다', () => {
    const result = validateConfig({ target: 4, maxAttempts: 50, ticket: fixed([6, 5, 4, 3, 2, 1]) })
    if (!result.ok) throw new Error('unexpected')
    expect(runBatch(createInitialState(), result.config, 50, seeded(1)).attempts).toBeGreaterThan(0)
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

// 최적화 전 engine으로 기록한 결과. 값은 수정하지 말고, 불일치하면 engine 동작이 바뀐 것이다.
// (rng 호출 순서·횟수, 번호 생성, 판정, 정지 규칙 전부 포함)
describe('골든 (최적화 회귀 방지)', () => {
  type Golden = { name: string; seed: number; config: SimConfig; expected: SimState }
  const goldens: Golden[] = [
    {
      name: '자동, 4등 목표',
      seed: 1,
      config: { target: 4, maxAttempts: null, ticket: { kind: 'auto' } },
      expected: { attempts: 909, wins: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 26 }, stop: { reason: 'target', draw: { main: [16, 24, 30, 32, 37, 42], bonus: 33 }, ticket: [7, 16, 18, 32, 37, 42] } },
    },
    {
      name: '자동, 4등 목표',
      seed: 2,
      config: { target: 4, maxAttempts: null, ticket: { kind: 'auto' } },
      expected: { attempts: 1362, wins: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 26 }, stop: { reason: 'target', draw: { main: [15, 18, 21, 23, 39, 43], bonus: 40 }, ticket: [15, 18, 19, 28, 39, 43] } },
    },
    {
      name: '자동, 4등 목표',
      seed: 3,
      config: { target: 4, maxAttempts: null, ticket: { kind: 'auto' } },
      expected: { attempts: 2547, wins: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 66 }, stop: { reason: 'target', draw: { main: [3, 13, 20, 34, 35, 40], bonus: 23 }, ticket: [8, 20, 31, 34, 35, 40] } },
    },
    {
      name: '자동, 4등 목표',
      seed: 4,
      config: { target: 4, maxAttempts: null, ticket: { kind: 'auto' } },
      expected: { attempts: 1745, wins: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 41 }, stop: { reason: 'target', draw: { main: [11, 22, 24, 30, 31, 44], bonus: 25 }, ticket: [24, 30, 31, 33, 43, 44] } },
    },
    {
      name: '자동, 3등 목표',
      seed: 5,
      config: { target: 3, maxAttempts: null, ticket: { kind: 'auto' } },
      expected: { attempts: 21231, wins: { 1: 0, 2: 0, 3: 1, 4: 29, 5: 455 }, stop: { reason: 'target', draw: { main: [1, 7, 13, 16, 27, 44], bonus: 17 }, ticket: [1, 3, 7, 13, 16, 44] } },
    },
    {
      name: '자동, 3등 목표',
      seed: 6,
      config: { target: 3, maxAttempts: null, ticket: { kind: 'auto' } },
      expected: { attempts: 22334, wins: { 1: 0, 2: 1, 3: 0, 4: 33, 5: 504 }, stop: { reason: 'target', draw: { main: [14, 15, 27, 30, 38, 41], bonus: 37 }, ticket: [14, 27, 30, 37, 38, 41] } },
    },
    {
      name: '자동, 3등 목표, limit 5000',
      seed: 10,
      config: { target: 3, maxAttempts: 5000, ticket: { kind: 'auto' } },
      expected: { attempts: 5000, wins: { 1: 0, 2: 0, 3: 0, 4: 11, 5: 120 }, stop: { reason: 'limit', draw: { main: [2, 3, 7, 15, 22, 29], bonus: 4 }, ticket: [6, 17, 18, 19, 36, 37] } },
    },
    {
      name: '자동, 2등 목표, limit 30000',
      seed: 7,
      config: { target: 2, maxAttempts: 30000, ticket: { kind: 'auto' } },
      expected: { attempts: 30000, wins: { 1: 0, 2: 0, 3: 2, 4: 45, 5: 696 }, stop: { reason: 'limit', draw: { main: [2, 11, 20, 22, 40, 41], bonus: 6 }, ticket: [14, 27, 29, 32, 38, 44] } },
    },
    {
      name: '자동, 2등 목표, limit 30000',
      seed: 8,
      config: { target: 2, maxAttempts: 30000, ticket: { kind: 'auto' } },
      expected: { attempts: 30000, wins: { 1: 0, 2: 0, 3: 0, 4: 46, 5: 629 }, stop: { reason: 'limit', draw: { main: [3, 7, 10, 11, 32, 39], bonus: 18 }, ticket: [1, 3, 7, 8, 27, 42] } },
    },
    {
      name: '자동, 1등 목표, limit 30000',
      seed: 9,
      config: { target: 1, maxAttempts: 30000, ticket: { kind: 'auto' } },
      expected: { attempts: 30000, wins: { 1: 0, 2: 0, 3: 1, 4: 38, 5: 674 }, stop: { reason: 'limit', draw: { main: [7, 9, 16, 19, 36, 44], bonus: 23 }, ticket: [3, 7, 22, 23, 25, 44] } },
    },
    {
      name: '고정 A, 4등 목표',
      seed: 11,
      config: { target: 4, maxAttempts: null, ticket: { kind: 'fixed', ticket: [3, 9, 17, 25, 33, 41] } },
      expected: { attempts: 218, wins: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 6 }, stop: { reason: 'target', draw: { main: [9, 17, 18, 23, 33, 41], bonus: 34 }, ticket: [3, 9, 17, 25, 33, 41] } },
    },
    {
      name: '고정 A, 4등 목표',
      seed: 12,
      config: { target: 4, maxAttempts: null, ticket: { kind: 'fixed', ticket: [3, 9, 17, 25, 33, 41] } },
      expected: { attempts: 1172, wins: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 25 }, stop: { reason: 'target', draw: { main: [9, 12, 14, 17, 25, 41], bonus: 5 }, ticket: [3, 9, 17, 25, 33, 41] } },
    },
    {
      name: '고정 A, 3등 목표',
      seed: 13,
      config: { target: 3, maxAttempts: null, ticket: { kind: 'fixed', ticket: [3, 9, 17, 25, 33, 41] } },
      expected: { attempts: 35507, wins: { 1: 0, 2: 0, 3: 1, 4: 48, 5: 786 }, stop: { reason: 'target', draw: { main: [3, 6, 9, 25, 33, 41], bonus: 35 }, ticket: [3, 9, 17, 25, 33, 41] } },
    },
    {
      name: '고정 A, 2등 목표, limit 30000',
      seed: 14,
      config: { target: 2, maxAttempts: 30000, ticket: { kind: 'fixed', ticket: [3, 9, 17, 25, 33, 41] } },
      expected: { attempts: 30000, wins: { 1: 0, 2: 0, 3: 1, 4: 47, 5: 693 }, stop: { reason: 'limit', draw: { main: [17, 18, 21, 24, 39, 45], bonus: 42 }, ticket: [3, 9, 17, 25, 33, 41] } },
    },
    {
      name: '고정 A, 1등 목표, limit 30000',
      seed: 15,
      config: { target: 1, maxAttempts: 30000, ticket: { kind: 'fixed', ticket: [3, 9, 17, 25, 33, 41] } },
      expected: { attempts: 30000, wins: { 1: 0, 2: 0, 3: 3, 4: 42, 5: 683 }, stop: { reason: 'limit', draw: { main: [1, 2, 17, 22, 43, 45], bonus: 40 }, ticket: [3, 9, 17, 25, 33, 41] } },
    },
    {
      name: '고정 B, 4등 목표',
      seed: 16,
      config: { target: 4, maxAttempts: null, ticket: { kind: 'fixed', ticket: [1, 2, 3, 4, 5, 6] } },
      expected: { attempts: 769, wins: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 14 }, stop: { reason: 'target', draw: { main: [1, 2, 4, 5, 6, 33], bonus: 27 }, ticket: [1, 2, 3, 4, 5, 6] } },
    },
  ]

  it.each(goldens)('$name (seed $seed)', ({ seed, config, expected }) => {
    expect(runBatch(createInitialState(), config, 1_000_000, seeded(seed))).toEqual(expected)
  })

  it('target과 limit 정지가 모두 포함된다', () => {
    const reasons = new Set(goldens.map((g) => g.expected.stop?.reason))
    expect(reasons).toEqual(new Set(['target', 'limit']))
  })
})
