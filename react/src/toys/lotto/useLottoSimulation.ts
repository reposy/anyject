import { useCallback, useEffect, useRef, useState } from 'react'
import { createInitialState, validateConfig } from './engine.ts'
import type { ConfigValidation, SimConfig, SimState } from './engine.ts'
import type { WorkerRequest, WorkerResponse } from './protocol.ts'

/**
 * finished: engine 정지(`state.stop !== null`), stopped: 사용자 정지(`state.stop === null`).
 * 사용자 정지는 engine의 StopReason에 없고 이 status로만 구분한다.
 */
export type SimStatus = 'idle' | 'running' | 'paused' | 'finished' | 'stopped' | 'error'

type Snapshot = { status: SimStatus; state: SimState; error: string | null }

const IDLE: Snapshot = { status: 'idle', state: createInitialState(), error: null }

export function useLottoSimulation() {
  const [snapshot, setSnapshot] = useState<Snapshot>(IDLE)
  // 이벤트 핸들러와 Worker 콜백이 렌더를 거치지 않고 최신 값을 읽기 위한 미러.
  const snapshotRef = useRef<Snapshot>(IDLE)
  const workerRef = useRef<Worker | null>(null)

  const commit = useCallback((next: Snapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
  }, [])

  // 핸들러를 먼저 떼어 늦게 도착하는 메시지가 상태에 섞이지 않게 한 뒤 종료한다.
  const dispose = useCallback(() => {
    const worker = workerRef.current
    if (worker === null) return
    worker.onmessage = null
    worker.onerror = null
    worker.onmessageerror = null
    worker.terminate()
    workerRef.current = null
  }, [])

  const fail = useCallback(
    (message: string) => {
      dispose()
      commit({ status: 'error', state: snapshotRef.current.state, error: message })
    },
    [commit, dispose],
  )

  // 언마운트 시 종료. Worker는 이펙트가 아니라 start()에서 만들기 때문에
  // StrictMode의 이중 이펙트 실행 시점에는 Worker가 없어 누수가 생기지 않는다.
  useEffect(() => dispose, [dispose])

  const start = useCallback(
    (config: SimConfig): ConfigValidation => {
      const validation = validateConfig(config)
      if (!validation.ok) return validation

      dispose() // 재시작도 항상 새 Worker. 이전 실행의 메시지가 섞일 수 없다.
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data
        switch (message.type) {
          case 'progress':
            commit({ ...snapshotRef.current, state: message.state })
            return
          case 'finished':
            dispose()
            commit({ status: 'finished', state: message.state, error: null })
            return
          case 'error':
            fail(message.message)
            return
        }
      }
      worker.onerror = (event) => fail(event.message || 'worker error')
      worker.onmessageerror = () => fail('worker message could not be deserialized')

      commit({ status: 'running', state: createInitialState(), error: null })
      const request: WorkerRequest = { type: 'start', config: validation.config }
      worker.postMessage(request)
      return validation
    },
    [commit, dispose, fail],
  )

  const pause = useCallback(() => {
    if (snapshotRef.current.status !== 'running') return
    commit({ ...snapshotRef.current, status: 'paused' })
    const request: WorkerRequest = { type: 'pause' }
    workerRef.current?.postMessage(request)
  }, [commit])

  const resume = useCallback(() => {
    if (snapshotRef.current.status !== 'paused') return
    commit({ ...snapshotRef.current, status: 'running' })
    const request: WorkerRequest = { type: 'resume' }
    workerRef.current?.postMessage(request)
  }, [commit])

  // 응답을 기다리지 않는다. 마지막으로 받은 상태(최대 ~100ms 이전)를 유지한다.
  const stop = useCallback(() => {
    const { status } = snapshotRef.current
    if (status !== 'running' && status !== 'paused') return
    dispose()
    commit({ ...snapshotRef.current, status: 'stopped' })
  }, [commit, dispose])

  const reset = useCallback(() => {
    dispose()
    commit(IDLE)
  }, [commit, dispose])

  return { ...snapshot, start, pause, resume, stop, reset }
}
