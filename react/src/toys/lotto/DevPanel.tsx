// 개발 서버 전용 임시 검증 화면(Phase 5에서 UI로 교체). 스타일 없음.
import { useState } from 'react'
import type { ConfigValidation, SimConfig, TargetRank } from './engine.ts'
import { useLottoSimulation } from './useLottoSimulation.ts'

export default function DevPanel() {
  const { status, state, error, start, pause, resume, stop, reset } = useLottoSimulation()
  const [target, setTarget] = useState('4')
  const [maxAttempts, setMaxAttempts] = useState('1000')
  const [infinite, setInfinite] = useState(true)
  const [mode, setMode] = useState<'auto' | 'fixed'>('auto')
  const [numbers, setNumbers] = useState('1,2,3,4,5,6')
  const [startResult, setStartResult] = useState<ConfigValidation | null>(null)

  // 입력을 그대로 숫자로 바꿔 넘긴다. 잘못된 값의 거부는 validateConfig가 맡는다.
  const onStart = () => {
    const config: SimConfig = {
      target: Number(target) as TargetRank,
      maxAttempts: infinite ? null : Number(maxAttempts),
      ticket: mode === 'auto' ? { kind: 'auto' } : { kind: 'fixed', ticket: numbers.split(',').map(Number) },
    }
    setStartResult(start(config))
  }

  return (
    <div>
      <p>
        <label>
          목표 등수{' '}
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}등
              </option>
            ))}
          </select>
        </label>
      </p>
      <p>
        <label>
          최대 횟수{' '}
          <input
            value={maxAttempts}
            disabled={infinite}
            onChange={(e) => setMaxAttempts(e.target.value)}
          />
        </label>{' '}
        <label>
          <input type="checkbox" checked={infinite} onChange={(e) => setInfinite(e.target.checked)} />
          무한
        </label>
      </p>
      <p>
        <label>
          <input type="radio" checked={mode === 'auto'} onChange={() => setMode('auto')} />
          자동
        </label>{' '}
        <label>
          <input type="radio" checked={mode === 'fixed'} onChange={() => setMode('fixed')} />
          고정
        </label>{' '}
        <input value={numbers} disabled={mode === 'auto'} onChange={(e) => setNumbers(e.target.value)} />
      </p>
      <p>
        <button onClick={onStart}>시작</button> <button onClick={pause}>일시정지</button>{' '}
        <button onClick={resume}>재개</button> <button onClick={stop}>정지</button>{' '}
        <button
          onClick={() => {
            reset()
            setStartResult(null)
          }}
        >
          리셋
        </button>
      </p>
      <pre>{JSON.stringify({ status, state, error, startResult }, null, 2)}</pre>
    </div>
  )
}
