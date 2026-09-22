// 당첨금·세금과 분기점 표시. 파생 값은 모두 prize.ts의 순수 함수로 계산하고, 여기서는 조립과 표시만 한다.
import { useMemo } from 'react'
import { RANKS, RANK_COMBINATIONS, TICKET_PRICE, TOTAL_COMBINATIONS } from './engine.ts'
import type { Rank } from './engine.ts'
import {
  breakEvenFirstPrize,
  expectedValueTable,
  expectedValueTotal,
  formatPercentDecimal,
  formatWon,
  formatWonDecimal,
} from './prize.ts'
import type { FirstPrizeValidation, TaxMode } from './prize.ts'
import styles from './LottoPanel.module.css'

const RANK_LABELS: Record<Rank, string> = { 1: '1등', 2: '2등', 3: '3등', 4: '4등', 5: '5등' }
const ESTIMATED_RANKS: ReadonlySet<Rank> = new Set([2, 3])
const FIXED_RANKS: ReadonlySet<Rank> = new Set([4, 5])

/** 확률을 "1/N" 형태로. 등수별 확률이 매우 작아 백분율로는 대부분 0.0%로 뭉개진다. */
function formatOdds(rank: Rank): string {
  const denominator = Math.round(TOTAL_COMBINATIONS / RANK_COMBINATIONS[rank])
  return `1/${denominator.toLocaleString('ko-KR')}`
}

type Props = {
  firstPrizeInput: string
  onFirstPrizeInputChange: (value: string) => void
  taxMode: TaxMode
  onTaxModeChange: (mode: TaxMode) => void
  firstPrizeValidation: FirstPrizeValidation
  prizeTable: Record<Rank, number> | null
}

export default function LottoPrizeTax({
  firstPrizeInput,
  onFirstPrizeInputChange,
  taxMode,
  onTaxModeChange,
  firstPrizeValidation,
  prizeTable,
}: Props) {
  const evTable = useMemo(() => (prizeTable ? expectedValueTable(prizeTable) : null), [prizeTable])
  const evTotal = useMemo(() => (prizeTable ? expectedValueTotal(prizeTable) : null), [prizeTable])
  const refundRate = evTotal !== null ? evTotal / TICKET_PRICE : null
  const breakEven = useMemo(() => breakEvenFirstPrize(taxMode), [taxMode])

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.heading}>당첨금·세금</h2>
        <label className={styles.label}>
          1등 금액(억 원)
          <input
            className={styles.numberInput}
            value={firstPrizeInput}
            inputMode="decimal"
            onChange={(e) => onFirstPrizeInputChange(e.target.value)}
          />
        </label>
        {!firstPrizeValidation.ok && (
          <p className={styles.error}>1등 금액 입력을 확인해 주세요(0.1억~10,000억, 소수 첫째 자리까지).</p>
        )}
        <label className={styles.label}>
          <input
            type="checkbox"
            checked={taxMode === 'post'}
            onChange={(e) => onTaxModeChange(e.target.checked ? 'post' : 'pre')}
          />
          세후로 표시
        </label>
        <p className={styles.note}>
          세금 기준(2023년 개정): 당첨금 200만 원 이하 비과세, 초과 시 과세표준(당첨금−1,000원) 중 3억
          원 이하분 22%, 3억 원 초과분 33%(지방소득세 포함)
        </p>
        {prizeTable && evTable && (
          <div className={styles.tableWrap}>
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
                    <td>
                      {formatWon(prizeTable[rank])}{' '}
                      {(ESTIMATED_RANKS.has(rank) || FIXED_RANKS.has(rank)) && (
                        <span className={styles.tag}>{ESTIMATED_RANKS.has(rank) ? '추정' : '고정'}</span>
                      )}
                    </td>
                    <td>{formatWonDecimal(evTable[rank])}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>합계</td>
                  <td>{evTotal !== null ? formatWonDecimal(evTotal) : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
    </>
  )
}
