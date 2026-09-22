// 결과 표시. 금액 지표는 현재(live) 당첨금 표를 매번 다시 적용해 계산한다(실행 중 1등 금액/세전세후
// 변경이 재시작 없이 바로 반영되도록). 시뮬레이션 조건은 시작 시점의 스냅샷(startedConfig)을 쓴다.
import { useMemo } from 'react'
import { RANKS, expectedAttempts, summarize } from './engine.ts'
import type { Draw, Rank, SimConfig, SimState, Ticket } from './engine.ts'
import { formatSignedWon, formatWon } from './prize.ts'
import type { SimStatus } from './useLottoSimulation.ts'
import styles from './LottoPanel.module.css'

const RANK_LABELS: Record<Rank, string> = { 1: '1등', 2: '2등', 3: '3등', 4: '4등', 5: '5등' }

const STATUS_LABELS: Record<SimStatus, string> = {
  idle: '대기',
  running: '실행 중',
  paused: '일시정지',
  finished: '완료',
  stopped: '정지',
  error: '오류',
}

function describeConfigSnapshot(config: SimConfig): string {
  const target = `목표 ${config.target}등`
  const repeat = config.maxAttempts === null ? '무한' : `최대 ${config.maxAttempts.toLocaleString('ko-KR')}회`
  const ticket =
    config.ticket.kind === 'auto' ? '자동' : `직접 입력 (${config.ticket.ticket.join(', ')})`
  return `${target} · ${repeat} · ${ticket}`
}

/**
 * 티켓과 추첨 번호를 나란히 그리는 번호 공.
 * - matched: 본번호 일치(추첨 본번호와 티켓에 공통으로 나타나는 번호)
 * - bonusSlot: 이 공이 추첨의 "보너스 번호 자리"인지(추첨 쪽 7번째 공에서만 true) — "보너스" 라벨은
 *   이 자리라는 사실만으로 항상 붙고, 일치 여부와는 무관하다(자리와 일치를 분리).
 * - bonusMatch: 보너스 번호가 실제로 티켓에 있는지 — 진한 배경(.bonusMatched)과 "●"는 이 값에만 따른다.
 */
function Ball({
  n,
  matched,
  bonusSlot = false,
  bonusMatch,
}: {
  n: number
  matched: boolean
  bonusSlot?: boolean
  bonusMatch: boolean
}) {
  const modifier = bonusMatch ? styles.bonusMatched : matched ? styles.matched : ''
  const className = modifier ? `${styles.ball} ${modifier}` : styles.ball
  const showDot = matched || bonusMatch
  const showBonusLabel = bonusSlot || bonusMatch
  return (
    <span className={className}>
      {n}
      {showDot && ' ●'}
      {showBonusLabel && <span className={styles.bonusTag}>보너스</span>}
    </span>
  )
}

function FinishedDraw({ draw, ticket }: { draw: Draw; ticket: Ticket }) {
  const matchCount = ticket.filter((n) => draw.main.includes(n)).length
  const bonusHit = ticket.includes(draw.bonus)

  return (
    <div>
      <p className={styles.inline}>
        본번호 {matchCount}개 일치{bonusHit ? ' · 보너스 일치' : ''}
      </p>
      <p className={styles.inline}>추첨 번호</p>
      <p>
        {draw.main.map((n) => (
          <Ball key={n} n={n} matched={ticket.includes(n)} bonusMatch={false} />
        ))}
        <Ball n={draw.bonus} matched={false} bonusSlot bonusMatch={bonusHit} />
      </p>
      <p className={styles.inline}>내 티켓</p>
      <p>
        {ticket.map((n) => (
          <Ball key={n} n={n} matched={draw.main.includes(n)} bonusMatch={n === draw.bonus} />
        ))}
      </p>
    </div>
  )
}

type Props = {
  status: SimStatus
  state: SimState
  error: string | null
  startedConfig: SimConfig | null
  prizeTable: Record<Rank, number> | null
}

export default function LottoResult({ status, state, error, startedConfig, prizeTable }: Props) {
  const summary = useMemo(
    () => (prizeTable ? summarize(state, prizeTable) : null),
    [state, prizeTable],
  )

  const statusLabel =
    STATUS_LABELS[status] +
    (status === 'finished' && state.stop
      ? state.stop.reason === 'target'
        ? ' (목표 도달)'
        : ' (횟수 소진)'
      : '')

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>결과</h2>
      <p className={styles.inline}>상태: {statusLabel}</p>

      {startedConfig === null ? (
        <p className={styles.inline}>아직 실행한 기록이 없습니다.</p>
      ) : (
        <>
          <p className={styles.snapshot}>이 실행의 조건: {describeConfigSnapshot(startedConfig)}</p>
          <p className={styles.inline}>
            누적 시도 {state.attempts.toLocaleString('ko-KR')}회 · 기대 시도{' '}
            {Math.round(expectedAttempts(startedConfig.target)).toLocaleString('ko-KR')}회
          </p>
          <p className={styles.inline}>누적 비용 {summary ? formatWon(summary.cost) : '—'}</p>
          <p className={styles.inline}>누적 당첨금 {summary ? formatWon(summary.winnings) : '—'}</p>
          <p className={styles.inline}>손익 {summary ? formatSignedWon(-summary.netLoss) : '—'}</p>
          <p className={styles.inline}>
            매주 1장 구매 시 {summary ? `${summary.years.toFixed(1)}년` : '—'}
          </p>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>등수</th>
                  <th>당첨 횟수</th>
                </tr>
              </thead>
              <tbody>
                {RANKS.map((rank) => (
                  <tr key={rank}>
                    <td>{RANK_LABELS[rank]}</td>
                    <td>{state.wins[rank].toLocaleString('ko-KR')}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {status === 'finished' && state.stop && (
            <FinishedDraw draw={state.stop.draw} ticket={state.stop.ticket} />
          )}
          {status === 'error' && error !== null && <p className={styles.error}>오류: {error}</p>}
        </>
      )}
    </section>
  )
}
