import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DddService } from '../../../libs/ddd';
import { User } from '../../users/domain/user.entity';
import { UserRepository } from '../../users/repository/user.repository';

const scrypt = promisify(scryptCallback);

@Injectable()
export class AuthService extends DddService {
    constructor(private readonly userRepository: UserRepository) {
        super();
    }

    async signup({
        email,
        password,
        name,
        nickname,
        profileImageUrl,
    }: {
        email: string;
        password: string;
        name: string;
        nickname?: string;
        profileImageUrl?: string;
    }) {
        const normalizedEmail = normalizeRequiredText({ value: email, fieldName: '이메일' }).toLowerCase();
        const normalizedPassword = normalizeRequiredText({ value: password, fieldName: '패스워드' });
        const normalizedName = normalizeRequiredText({ value: name, fieldName: '이름' });
        const normalizedNickname = normalizeOptionalText(nickname);
        const normalizedProfileImageUrl = normalizeOptionalText(profileImageUrl);
        const existingUserCount = await this.userRepository.count({ email: normalizedEmail });

        if (existingUserCount > 0) {
            throw new ConflictException('이미 가입된 이메일입니다.');
        }

        const user = new User({
            email: normalizedEmail,
            password: await hashPassword(normalizedPassword),
            name: normalizedName,
            nickname: normalizedNickname,
            profileImageUrl: normalizedProfileImageUrl,
        });

        await this.userRepository.save([user]);

        return toSignupResponse(user);
    }

    async signIn({ email, password }: { email: string; password: string }) {
        const normalizedEmail = normalizeRequiredText({ value: email, fieldName: '이메일' }).toLowerCase();
        const normalizedPassword = normalizeRequiredText({ value: password, fieldName: '패스워드' });
        const [user] = await this.userRepository.find({ email: normalizedEmail });

        if (
            !user ||
            user.status !== 'active' ||
            !(await verifyPassword({ password: normalizedPassword, hash: user.password }))
        ) {
            throw new UnauthorizedException('이메일 또는 패스워드가 올바르지 않습니다.');
        }

        return {
            accessToken: signAccessToken(user),
            user: toSignupResponse(user),
        };
    }
}

function normalizeRequiredText({ value, fieldName }: { value?: string; fieldName: string }) {
    const trimmedValue = value?.trim();

    if (!trimmedValue) {
        throw new BadRequestException(`${fieldName}이 필요합니다.`);
    }

    return trimmedValue;
}

function normalizeOptionalText(value?: string) {
    const trimmedValue = value?.trim();

    return trimmedValue || undefined;
}

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const key = (await scrypt(password, salt, 64)) as Buffer;

    return `scrypt:${salt}:${key.toString('hex')}`;
}

async function verifyPassword({ password, hash }: { password: string; hash: string }) {
    const [algorithm, salt, storedKey] = hash.split(':');

    if (algorithm !== 'scrypt' || !salt || !storedKey) {
        return false;
    }

    const key = (await scrypt(password, salt, 64)) as Buffer;
    const storedKeyBuffer = Buffer.from(storedKey, 'hex');

    return storedKeyBuffer.length === key.length && timingSafeEqual(storedKeyBuffer, key);
}

function signAccessToken(user: User) {
    const secret =
        process.env.ECHOCAST_JWT_SECRET ??
        process.env.NEW_DUBRIGHT_JWT_SECRET ??
        process.env.JWT_SECRET ??
        (process.env.NODE_ENV === 'production' ? undefined : 'echocast-local-dev-secret');

    if (!secret) {
        throw new InternalServerErrorException('JWT secret 설정이 필요합니다.');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        userId: user.id,
        email: user.email,
        iat: now,
        exp: now + 60 * 60 * 24,
    };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const encodedSignature = createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

function toSignupResponse(user: User) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        status: user.status,
    };
}
