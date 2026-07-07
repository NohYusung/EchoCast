import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

type JwtPayload = {
    id?: number | string;
    userId?: number | string;
    sub?: number | string;
    exp?: number;
    [key: string]: unknown;
};

const jwtAlgorithms = {
    HS256: 'sha256',
    HS384: 'sha384',
    HS512: 'sha512',
} as const;

@Injectable()
export class JwtHelperService {
    decodeAccessToken(accessToken: string): JwtPayload | undefined {
        const [encodedHeader, encodedPayload, encodedSignature] = accessToken.split('.');

        if (!encodedHeader || !encodedPayload || !encodedSignature) {
            return undefined;
        }

        const header = this.decodeJson<{ alg?: keyof typeof jwtAlgorithms }>(encodedHeader);
        const payload = this.decodeJson<JwtPayload>(encodedPayload);

        if (!header || !payload) {
            return undefined;
        }

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return undefined;
        }

        const secret = process.env.ECHOCAST_JWT_SECRET ?? process.env.NEW_DUBRIGHT_JWT_SECRET ?? process.env.JWT_SECRET;

        if (!secret) {
            return process.env.NODE_ENV === 'production' ? undefined : payload;
        }

        const hashAlgorithm = header.alg ? jwtAlgorithms[header.alg] : undefined;

        if (!hashAlgorithm) {
            return undefined;
        }

        const expectedSignature = createHmac(hashAlgorithm, secret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64url');
        const expectedBuffer = Buffer.from(expectedSignature);
        const actualBuffer = Buffer.from(encodedSignature);

        if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
            return undefined;
        }

        return payload;
    }

    private decodeJson<T>(encodedValue: string): T | undefined {
        try {
            return JSON.parse(Buffer.from(encodedValue, 'base64url').toString('utf8')) as T;
        } catch {
            return undefined;
        }
    }
}
