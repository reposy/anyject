// 1~45 번호판(7열). 고정 티켓 직접 입력에 쓴다. mode가 자동으로 바뀌어도 selected는 이 컴포넌트
// 밖(LottoSettings)에서 유지되므로 여기서는 항상 현재 선택 상태만 그린다.
import styles from './NumberGrid.module.css'

const TICKET_SIZE = 6 // engine.ts의 티켓 크기와 같다(로또 6/45).
// 순수 호출로 표시해 프로덕션에서 이 컴포넌트가 쓰이지 않을 때 트리셰이킹되게 한다(engine.ts의 IDENTITY와 동일).
const NUMBERS = /* @__PURE__ */ Array.from({ length: 45 }, (_, i) => i + 1)

type Props = {
  selected: readonly number[]
  onToggle: (n: number) => void
  onReset: () => void
}

export default function NumberGrid({ selected, onToggle, onReset }: Props) {
  const isFull = selected.length >= TICKET_SIZE

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.count}>
          {selected.length}/{TICKET_SIZE}
        </span>
        <button type="button" onClick={onReset} disabled={selected.length === 0}>
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
              disabled={!isSelected && isFull}
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
