// 로또 시뮬레이션 Worker. 계산과 판정은 engine이 하고, 여기서는 시간 배분과 메시지만 다룬다.
import { createInitialState, runBatch, validateConfig } from './engine.ts'
import type { SimConfig, SimState } from './engine.ts'
import type { WorkerRequest, WorkerResponse } from './protocol.ts'

/** 한 번에 계산하는 시간. pause 메시지가 최대 이만큼 늦게 처리된다. */
const SLICE_MS = 20
/** 진행 상태 전송 주기(초당 10회). */
const PROGRESS_MS = 100
/** 시간 확인 사이에 실행하는 시도 수. */
const CHUNK_ATTEMPTS = 1000

// tsconfig는 DOM lib만 쓰므로(webworker lib과 충돌) Worker 전역에 필요한 부분만 타입을 준다.
const scope = self as unknown as {
  postMessage(message: WorkerResponse): void
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void
}

type Run = { config: SimConfig; state: SimState; paused: boolean; driving: boolean }

let run: Run | null = null

// setTimeout(0)은 중첩 시 4ms로 클램프되어 낭비가 크다. 자기 자신에게 보내는 메시지로 양보한다.
const channel = new MessageChannel()
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })
}

async function drive(current: Run): Promise<void> {
  current.driving = true
  let lastProgress = performance.now()
  while (!current.paused) {
    const sliceEnd = performance.now() + SLICE_MS
    do {
      current.state = runBatch(current.state, current.config, CHUNK_ATTEMPTS, Math.random)
    } while (current.state.stop === null && performance.now() < sliceEnd)

    if (current.state.stop !== null) {
      scope.postMessage({ type: 'finished', state: current.state })
      break
    }
    if (performance.now() - lastProgress >= PROGRESS_MS) {
      scope.postMessage({ type: 'progress', state: current.state })
      lastProgress = performance.now()
    }
    await yieldToEventLoop()
  }
  current.driving = false
}

scope.addEventListener('message', (event) => {
  const message = event.data
  switch (message.type) {
    case 'start': {
      if (run !== null) return
      const validation = validateConfig(message.config)
      if (!validation.ok) {
        scope.postMessage({
          type: 'error',
          message: `invalid config: ${JSON.stringify(validation.error)}`,
        })
        return
      }
      run = {
        config: validation.config,
        state: createInitialState(),
        paused: false,
        driving: false,
      }
      void drive(run)
      return
    }
    case 'pause':
      if (run === null || run.paused || run.state.stop !== null) return
      run.paused = true
      // 루프는 양보 중이므로 state는 최신이다. 일시정지 화면이 정확하도록 바로 보낸다.
      scope.postMessage({ type: 'progress', state: run.state })
      return
    case 'resume':
      if (run === null || !run.paused || run.state.stop !== null) return
      run.paused = false
      if (!run.driving) void drive(run)
      return
  }
})
