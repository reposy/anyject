// 로또 설정 화면(DEV 전용). 시작 버튼과 시뮬레이션 연결은 Phase 5b에서 한다.
// 파생 값(기대액, 분기점 등)은 모두 prize.ts/engine.ts의 순수 함수로 계산하고, 여기서는 조립과 표시만 한다.
import { useMemo, useState } from 'react'
import {
  RANKS,
  RANK_COMBINATIONS,
  TICKET_PRICE,
  TOTAL_COMBINATIONS,
  WEEKS_PER_YEAR,
  expectedAttempts,
  expectedCost,
  validateConfig,
} from './engine.ts'
import type { Rank, SimConfig, TargetRank, TicketMode } from './engine.ts'
import {
  breakEvenFirstPrize,
  expectedValueTable,
  expectedValueTotal,
  formatPercentDecimal,
  formatWon,
  formatWonDecimal,
  prizeTableFor,
  validateFirstPrizeInput,
} from './prize.ts'
import type { TaxMode } from './prize.ts'
import NumberGrid from './NumberGrid.tsx'
import styles from './LottoSettings.module.css'

const TARGET_OPTIONS: readonly TargetRank[] = [1, 2, 3, 4]
const RANK_LABELS: Record<Rank, string> = { 1: '1등', 2: '2등', 3: '3등', 4: '4등', 5: '5등' }
const ESTIMATED_RANKS: ReadonlySet<Rank> = new Set([2, 3])
const FIXED_RANKS: ReadonlySet<Rank> = new Set([4, 5])

/** 확률을 "1/N" 형태로. 등수별 확률이 매우 작아 백분율로는 대부분 0.0%로 뭉개진다. */
function formatOdds(rank: Rank): string {
  const denominator = Math.round(TOTAL_COMBINATIONS / RANK_COMBINATIONS[rank])
  return `1/${denominator.toLocaleString('ko-KR')}`
}

export default function LottoSettings() {
  const [target, setTarget] = useState<TargetRank>(4)
  const [infinite, setInfinite] = useState(true)
  const [maxAttemptsInput, setMaxAttemptsInput] = useState('1000')
  const [mode, setMode] = useState<'auto' | 'fixed'>('auto')
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [firstPrizeInput, setFirstPrizeInput] = useState('20')
  const [taxMode, setTaxMode] = useState<TaxMode>('pre')

  const toggleNumber = (n: number) => {
    setSelectedNumbers((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n)
      if (prev.length >= 6) return prev
      return [...prev, n].sort((a, b) => a - b)
    })
  }

  const targetInfo = useMemo(() => {
    const attempts = expectedAttempts(target)
    return { attempts, cost: expectedCost(target), years: attempts / WEEKS_PER_YEAR }
  }, [target])

  const firstPrizeValidation = useMemo(
    () => validateFirstPrizeInput(Number(firstPrizeInput)),
    [firstPrizeInput],
  )

  const prizeTable = useMemo(
    () => (firstPrizeValidation.ok ? prizeTableFor(firstPrizeValidation.won, taxMode) : null),
    [firstPrizeValidation, taxMode],
  )
  const evTable = useMemo(() => (prizeTable ? expectedValueTable(prizeTable) : null), [prizeTable])
  const evTotal = useMemo(() => (prizeTable ? expectedValueTotal(prizeTable) : null), [prizeTable])
  const refundRate = evTotal !== null ? evTotal / TICKET_PRICE : null

  const breakEven = useMemo(() => breakEvenFirstPrize(taxMode), [taxMode])

  const ticket: TicketMode =
    mode === 'auto' ? { kind: 'auto' } : { kind: 'fixed', ticket: selectedNumbers }
  const simConfig: SimConfig = {
    target,
    maxAttempts: infinite ? null : Number(maxAttemptsInput),
    ticket,
  }
  const configValidation = validateConfig(simConfig)

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h2 className={styles.heading}>목표 등수</h2>
        <label className={styles.label}>
          목표 등수
          <select
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) as TargetRank)}
          >
            {TARGET_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}등
              </option>
            ))}
          </select>
        </label>
        <p className={styles.inline}>
          기대 시도 {Math.round(targetInfo.attempts).toLocaleString('ko-KR')}회 · 기대 비용{' '}
          {formatWon(targetInfo.cost)} · 매주 1장 구매 시 {targetInfo.years.toFixed(1)}년
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>반복</h2>
        <label className={styles.label}>
          최대 횟수
          <input
            className={styles.numberInput}
            value={maxAttemptsInput}
            disabled={infinite}
            inputMode="numeric"
            onChange={(e) => setMaxAttemptsInput(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={infinite}
            onChange={(e) => setInfinite(e.target.checked)}
          />
          무한
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>번호 방식</h2>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>번호 방식</legend>
          <label className={styles.label}>
            <input
              type="radio"
              name="lotto-ticket-mode"
              checked={mode === 'auto'}
              onChange={() => setMode('auto')}
            />
            자동
          </label>
          <label className={styles.label}>
            <input
              type="radio"
              name="lotto-ticket-mode"
              checked={mode === 'fixed'}
              onChange={() => setMode('fixed')}
            />
            직접 입력
          </label>
        </fieldset>
        {mode === 'fixed' && (
          <NumberGrid
            selected={selectedNumbers}
            onToggle={toggleNumber}
            onReset={() => setSelectedNumbers([])}
          />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>당첨금</h2>
        <label className={styles.label}>
          1등 금액(억 원)
          <input
            className={styles.numberInput}
            value={firstPrizeInput}
            inputMode="decimal"
            onChange={(e) => setFirstPrizeInput(e.target.value)}
          />
        </label>
        {!firstPrizeValidation.ok && (
          <p className={styles.error}>1등 금액 입력을 확인해 주세요(0.1억~10,000억, 소수 첫째 자리까지).</p>
        )}
        {prizeTable && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>등수</th>
                <th>당첨금</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((rank) => (
                <tr key={rank}>
                  <td>{RANK_LABELS[rank]}</td>
                  <td>{formatWon(prizeTable[rank])}</td>
                  <td className={styles.tag}>
                    {ESTIMATED_RANKS.has(rank) ? '추정' : FIXED_RANKS.has(rank) ? '고정' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>세전/세후</h2>
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={taxMode === 'post'}
            onChange={(e) => setTaxMode(e.target.checked ? 'post' : 'pre')}
          />
          세후로 표시
        </label>
        <p className={styles.note}>
          세금 기준(2023년 개정): 당첨금 200만 원 이하 비과세, 초과 시 과세표준(당첨금−1,000원) 중 3억
          원 이하분 22%, 3억 원 초과분 33%(지방소득세 포함)
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>기대값</h2>
        {evTable && prizeTable && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>등수</th>
                <th>확률</th>
                <th>당첨금</th>
                <th>1장당 기대액</th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((rank) => (
                <tr key={rank}>
                  <td>{RANK_LABELS[rank]}</td>
                  <td>{formatOdds(rank)}</td>
                  <td>{formatWon(prizeTable[rank])}</td>
                  <td>{formatWonDecimal(evTable[rank])}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3}>합계</td>
                <td>{evTotal !== null ? formatWonDecimal(evTotal) : '-'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>분기점</h2>
        <p className={styles.inline}>
          {taxMode === 'pre' ? '세전' : '세후'} 기준 분기점 1등 금액: {formatWon(breakEven)}
        </p>
        {evTotal !== null && refundRate !== null && (
          <p className={styles.inline}>
            1,000원당 기대 환급 {formatWonDecimal(evTotal)} (환급률 {formatPercentDecimal(refundRate)})
          </p>
        )}
      </section>

      <section className={styles.debug}>
        <p className={styles.debugLabel}>SimConfig / validateConfig (DEV)</p>
        <pre className={styles.debugPre}>
          {JSON.stringify({ simConfig, configValidation }, null, 2)}
        </pre>
      </section>
    </div>
  )
}
