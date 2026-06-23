import { Body, Controller, Dependencies, HttpCode, Post } from '@nestjs/common';
import { AuthService } from '../applications/auth.service';
import { AuthSignInDto, AuthSignupDto } from './dto';

@Dependencies(AuthService)
@Controller('/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    /**
     * 회원가입
     */
    @Post('/signup')
    async signup(@Body() body: AuthSignupDto) {
        // 1. Destructure body, params, query
        const { email, password, name, nickname, profileImageUrl } = body;

        // 2. Get context

        // 3. Get result
        await this.authService.signup({
            email,
            password,
            name,
            nickname,
            profileImageUrl,
        });

        // 4. Send response
        return { data: {} };
    }

    /**
     * 로그인
     */
    @HttpCode(200)
    @Post('/signIn')
    async signIn(@Body() body: AuthSignInDto) {
        // 1. Destructure body, params, query
        const { email, password } = body;

        // 2. Get context

        // 3. Get result
        const data = await this.authService.signIn({
            email,
            password,
        });

        // 4. Send response
        return { data };
    }
}
