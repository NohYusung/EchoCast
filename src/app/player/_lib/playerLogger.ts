/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Player 모듈 전용 로거
 *
 * 환경변수 NEXT_PUBLIC_ENABLE_PLAYER_LOGS로 제어됩니다.
 * - 기본값: false (프로덕션)
 * - 개발: .env.local에서 'true'로 설정
 *
 * Next.js 빌드 시 tree shaking으로 프로덕션에서는 로그 코드가 완전히 제거됩니다.
 */

const ENABLE_PLAYER_LOGS = process.env.NEXT_PUBLIC_ENABLE_PLAYER_LOGS === 'true';

class PlayerLogger {
  private enabled: boolean;

  constructor(enabled: boolean = ENABLE_PLAYER_LOGS) {
    this.enabled = enabled;
  }

  log(...args: any[]) {
    if (this.enabled) {
      console.log(...args);
    }
  }

  warn(...args: any[]) {
    if (this.enabled) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    // 에러는 프로덕션에서도 항상 출력
    console.error(...args);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

export const playerLogger = new PlayerLogger();
