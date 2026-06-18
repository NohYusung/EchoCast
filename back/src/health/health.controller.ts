import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
    /**
     * 로드밸런서 헬스체크
     */
    @Get('/health')
    async check() {
        // 1. Destructure body, params, query

        // 2. Get context

        // 3. Get result
        const data = { status: 'ok' };

        // 4. Send response
        return { data };
    }
}
