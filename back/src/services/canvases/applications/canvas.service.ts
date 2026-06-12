import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { MediaRepository } from '../../medias/repository/media.repository';
import { Canvas } from '../domain/canvas.entity';
import { CanvasRepository } from '../repository/canvas.repository';

@Injectable()
export class CanvasService extends DddService {
    constructor(
        private readonly canvasRepository: CanvasRepository,
        private readonly mediaRepository: MediaRepository
    ) {
        super();
    }

    async create({
        episodeId,
        medias,
    }: {
        episodeId: number;
        medias: Array<{
            mediaId: number;
            index?: number;
        }>;
    }) {
        const mediaItems = await Promise.all(
            medias.map(async (media) => {
                const mediaItem = await this.mediaRepository.findOneByEpisodeId({ episodeId, mediaId: media.mediaId });

                if (!mediaItem) {
                    throw new NotFoundException('Media not found.');
                }

                return mediaItem;
            })
        );
        const canvas = new Canvas({ episodeId });

        await this.canvasRepository.save([canvas]);

        mediaItems.forEach((media, index) => {
            media.canvasId = canvas.id;
            media.index = medias[index]?.index;
        });

        if (mediaItems.length > 0) {
            await this.mediaRepository.save(mediaItems);
        }

        return {
            id: canvas.id,
            episodeId: canvas.episodeId,
            medias: mediaItems.map((media) => ({
                id: media.id,
                episodeId: media.episodeId,
                canvasId: media.canvasId,
                mediaName: media.mediaName,
                mediaType: media.mediaType,
                mediaUrl: media.mediaUrl,
                index: media.index,
            })),
        };
    }

    async list({ episodeId }: { episodeId: number }) {
        const [canvases, total] = await Promise.all([
            this.canvasRepository.find({ episodeId }, { relations: { medias: true } }),
            this.canvasRepository.count({ episodeId }),
        ]);
        const items = canvases
            .map((canvas) => {
                const medias = [...canvas.medias].sort(
                    (a, b) =>
                        (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
                );
                const [media] = medias;

                return {
                    id: canvas.id,
                    episodeId: canvas.episodeId,
                    mediaId: media?.id,
                    mediaName: media?.mediaName,
                    mediaType: media?.mediaType,
                    mediaUrl: media?.mediaUrl,
                    index: media?.index,
                    medias: medias.map((mediaItem) => ({
                        mediaId: mediaItem.id,
                        mediaName: mediaItem.mediaName,
                        mediaType: mediaItem.mediaType,
                        mediaUrl: mediaItem.mediaUrl,
                        index: mediaItem.index,
                    })),
                };
            })
            .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));

        return { items, total };
    }
}
