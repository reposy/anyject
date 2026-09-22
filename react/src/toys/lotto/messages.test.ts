import { describe, expect, it } from 'vitest'
import { describeConfigError } from './messages.ts'

describe('describeConfigError', () => {
  it('target 오류', () => {
    expect(describeConfigError({ kind: 'target', value: 5 })).toBe('목표 등수를 선택해 주세요.')
  })

  it('maxAttempts 오류', () => {
    expect(describeConfigError({ kind: 'maxAttempts', value: 0 })).toBe(
      '최대 횟수는 1 이상의 정수를 입력해 주세요.',
    )
  })

  it('ticket: count 오류', () => {
    expect(
      describeConfigError({ kind: 'ticket', error: { kind: 'count', actual: 5 } }),
    ).toBe('번호를 6개 선택해 주세요. (현재 5개)')
  })

  it('ticket: range 오류', () => {
    expect(
      describeConfigError({ kind: 'ticket', error: { kind: 'range', values: [0, 46] } }),
    ).toBe('번호는 1~45 사이여야 합니다.')
  })

  it('ticket: duplicate 오류', () => {
    expect(
      describeConfigError({ kind: 'ticket', error: { kind: 'duplicate', values: [7] } }),
    ).toBe('중복된 번호가 있습니다.')
  })
})
