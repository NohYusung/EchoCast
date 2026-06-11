import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { CanvasRepository } from '../repository/canvas.repository';

@Injectable()
export class CanvasService extends DddService {
    constructor(private readonly canvasRepository: CanvasRepository) {
        super();
    }

    async list({ episodeId }: { episodeId: number }) {
        const [canvases, total] = await Promise.all([
            this.canvasRepository.find(
                { episodeId },
                { relations: { medias: true } }
            ),
            this.canvasRepository.count({ episodeId }),
        ]);
        const items = canvases.map((canvas) => {
            const [media] = canvas.medias;

            return {
                id: canvas.id,
                episodeId: canvas.episodeId,
                mediaId: media?.id,
                mediaType: media?.mediaType,
                mediaUrl: media?.mediaUrl,
                index: media?.index,
            };
        }).sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));

        return { items, total };
    }
}
