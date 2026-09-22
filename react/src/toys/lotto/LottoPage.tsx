// 로또 시뮬레이터 화면. 조건·실행은 여기서 직접 다루고, 결과와 당첨금·세금·분기점은 표시 전용
// 컴포넌트(LottoResult, LottoPrizeTax)로 분리한다. 상태 소유자는 이 컴포넌트 하나뿐이다.
import { useState } from 'react'
import { expectedAttempts, expectedCost, TICKET_SIZE, validateConfig, WEEKS_PER_YEAR } from './engine.ts'
import type { ConfigValidation, SimConfig, TargetRank, TicketMode } from './engine.ts'
import { formatWon, prizeTableFor, validateFirstPrizeInput } from './prize.ts'
import type { TaxMode } from './prize.ts'
import { describeConfigError } from './messages.ts'
import { useLottoSimulation } from './useLottoSimulation.ts'
import NumberGrid from './NumberGrid.tsx'
import LottoResult from './LottoResult.tsx'
import LottoPrizeTax from './LottoPrizeTax.tsx'
import styles from './LottoPanel.module.css'

const TARGET_OPTIONS: readonly TargetRank[] = [1, 2, 3, 4]

export default function LottoPage() {
  const { status, state, error, start, pause, resume, stop, reset } = useLottoSimulation()

  // 조건 입력. running/paused 동안 잠긴다(아래 locked).
  const [target, setTarget] = useState<TargetRank>(4)
  const [infinite, setInfinite] = useState(true)
  const [maxAttemptsInput, setMaxAttemptsInput] = useState('1000')
  const [mode, setMode] = useState<'auto' | 'fixed'>('auto')
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])

  // 금액 입력. 실행 중에도 항상 편집 가능하고, 결과의 금액 지표에 즉시 반영된다.
  const [firstPrizeInput, setFirstPrizeInput] = useState('20')
  const [taxMode, setTaxMode] = useState<TaxMode>('pre')

  // 시작 시점의 조건 스냅샷. "이 실행의 조건 요약"에 쓰며, 실행 결과에 속하므로 reset 시 함께 지운다.
  const [startedConfig, setStartedConfig] = useState<SimConfig | null>(null)

  const locked = status === 'running' || status === 'paused'

  const toggleNumber = (n: number) => {
    setSelectedNumbers((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n)
      if (prev.length >= TICKET_SIZE) return prev
      return [...prev, n].sort((a, b) => a - b)
    })
  }

  const targetInfo = {
    attempts: expectedAttempts(target),
    cost: expectedCost(target),
    years: expectedAttempts(target) / WEEKS_PER_YEAR,
  }

  const firstPrizeValidation = validateFirstPrizeInput(Number(firstPrizeInput))
  const prizeTable = firstPrizeValidation.ok ? prizeTableFor(firstPrizeValidation.won, taxMode) : null

  const ticket: TicketMode =
    mode === 'auto' ? { kind: 'auto' } : { kind: 'fixed', ticket: selectedNumbers }
  const simConfig: SimConfig = {
    target,
    maxAttempts: infinite ? null : Number(maxAttemptsInput),
    ticket,
  }
  const configValidation: ConfigValidation = validateConfig(simConfig)
  const canStart = !locked && configValidation.ok

  const onStart = () => {
    const result = start(simConfig)
    if (result.ok) setStartedConfig(result.config)
  }
  const onReset = () => {
    reset()
    setStartedConfig(null)
  }

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <h2 className={styles.heading}>조건</h2>
        <label className={styles.label}>
          목표 등수
          <select
            value={target}
            disabled={locked}
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

        <label className={styles.label}>
          최대 횟수
          <input
            className={styles.numberInput}
            value={maxAttemptsInput}
            disabled={locked || infinite}
            inputMode="numeric"
            onChange={(e) => setMaxAttemptsInput(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={infinite}
            disabled={locked}
            onChange={(e) => setInfinite(e.target.checked)}
          />
          무한
        </label>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>번호 방식</legend>
          <label className={styles.label}>
            <input
              type="radio"
              name="lotto-ticket-mode"
              checked={mode === 'auto'}
              disabled={locked}
              onChange={() => setMode('auto')}
            />
            자동
          </label>
          <label className={styles.label}>
            <input
              type="radio"
              name="lotto-ticket-mode"
              checked={mode === 'fixed'}
              disabled={locked}
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
            disabled={locked}
          />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>실행</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onStart} disabled={!canStart}>
            시작
          </button>
          <button type="button" onClick={pause} disabled={status !== 'running'}>
            일시정지
          </button>
          <button type="button" onClick={resume} disabled={status !== 'paused'}>
            재개
          </button>
          <button type="button" onClick={stop} disabled={!locked}>
            정지
          </button>
          <button type="button" onClick={onReset}>
            리셋
          </button>
        </div>
        {!configValidation.ok && (
          <p className={styles.error}>{describeConfigError(configValidation.error)}</p>
        )}
      </section>

      <LottoResult
        status={status}
        state={state}
        error={error}
        startedConfig={startedConfig}
        prizeTable={prizeTable}
      />

      <LottoPrizeTax
        firstPrizeInput={firstPrizeInput}
        onFirstPrizeInputChange={setFirstPrizeInput}
        taxMode={taxMode}
        onTaxModeChange={setTaxMode}
        firstPrizeValidation={firstPrizeValidation}
        prizeTable={prizeTable}
      />
    </div>
  )
}
