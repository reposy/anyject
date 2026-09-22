// 1~45 번호판(7열). 고정 티켓 직접 입력에 쓴다. mode가 자동으로 바뀌어도 selected는 이 컴포넌트
// 밖(LottoPage)에서 유지되므로 여기서는 항상 현재 선택 상태만 그린다.
import { MAX_NUMBER, TICKET_SIZE } from './engine.ts'
import styles from './NumberGrid.module.css'

// 모듈 스코프에서 한 번만 계산되는 순수 배열이라 /* @__PURE__ */로 표시한다(engine.ts의 IDENTITY와 동일한 패턴).
const NUMBERS = /* @__PURE__ */ Array.from({ length: MAX_NUMBER }, (_, i) => i + 1)

type Props = {
  selected: readonly number[]
  onToggle: (n: number) => void
  onReset: () => void
  /** 시뮬레이션 실행 중(running/paused)에는 true로 그려 선택을 잠근다. */
  disabled?: boolean
}

export default function NumberGrid({ selected, onToggle, onReset, disabled = false }: Props) {
  const isFull = selected.length >= TICKET_SIZE

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.count}>
          {selected.length}/{TICKET_SIZE}
        </span>
        <button type="button" onClick={onReset} disabled={disabled || selected.length === 0}>
          선택 초기화
        </button>
      </div>
      <div className={styles.grid}>
        {NUMBERS.map((n) => {
          const isSelected = selected.includes(n)
          return (
            <button
              key={n}
              type="button"
              className={styles.cell}
              aria-pressed={isSelected}
              disabled={disabled || (!isSelected && isFull)}
              onClick={() => onToggle(n)}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
