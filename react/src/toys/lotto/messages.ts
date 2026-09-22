// validateConfig 실패 사유를 화면 문구로 바꾼다. engine.ts는 순수 로직만 두므로(계층 원칙) UI 문구는 여기서 만든다.
import { MAX_NUMBER, TICKET_SIZE } from './engine.ts'
import type { ConfigError, TicketError } from './engine.ts'

function describeTicketError(error: TicketError): string {
  switch (error.kind) {
    case 'count':
      return `번호를 ${TICKET_SIZE}개 선택해 주세요. (현재 ${error.actual}개)`
    case 'range':
      return `번호는 1~${MAX_NUMBER} 사이여야 합니다.`
    case 'duplicate':
      return '중복된 번호가 있습니다.'
  }
}

export function describeConfigError(error: ConfigError): string {
  switch (error.kind) {
    case 'target':
      return '목표 등수를 선택해 주세요.'
    case 'maxAttempts':
      return '최대 횟수는 1 이상의 정수를 입력해 주세요.'
    case 'ticket':
      return describeTicketError(error.error)
  }
}
