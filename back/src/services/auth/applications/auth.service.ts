import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
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
