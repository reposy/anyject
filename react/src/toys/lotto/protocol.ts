// 메인 스레드와 Worker가 공유하는 메시지 타입. Worker 하나는 start를 한 번만 처리한다.
import type { SimConfig, SimState } from './engine.ts'

export type WorkerRequest =
  | { type: 'start'; config: SimConfig }
  | { type: 'pause' }
  | { type: 'resume' }

export type WorkerResponse =
  /** 주기적 진행 상태. pause 처리 직후에도 현재 상태를 한 번 보낸다. */
  | { type: 'progress'; state: SimState }
  /** engine 정지(목표 도달 또는 횟수 소진). `state.stop`은 항상 non-null. */
  | { type: 'finished'; state: SimState }
  | { type: 'error'; message: string }
