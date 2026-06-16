import { BadRequestException } from '@nestjs/common';

export class PlayerManifestQueryDto {
    canvasId?: string;

    static toServiceQuery(query: PlayerManifestQueryDto) {
        if (query.canvasId === undefined) {
            return {};
        }

        if (!/^[1-9]\d*$/.test(query.canvasId)) {
            throw new BadRequestException('canvasId는 양의 정수여야 합니다.');
        }

        return {
            canvasId: Number.parseInt(query.canvasId, 10),
        };
    }
}
