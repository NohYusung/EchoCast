import { Injectable, NotFoundException } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { CanvasMedia } from '../../canvas-medias/domain/canvas-media.entity';
import { CanvasMediaRepository } from '../../canvas-medias/repository/canvas-media.repository';
import { MediaRepository } from '../../medias/repository/media.repository';
import { Canvas } from '../domain/canvas.entity';
import { CanvasRepository } from '../repository/canvas.repository';

type CanvasMediaInput = {
    mediaId: number;
    index?: number;
};

@Injectable()
export class CanvasService extends DddService {
    constructor(
        private readonly canvasRepository: CanvasRepository,
        private readonly mediaRepository: MediaRepository,
        private readonly canvasMediaRepository: CanvasMediaRepository
    ) {
        super();
    }

    async create({
        episodeId,
        medias,
    }: {
        episodeId: number;
        medias: CanvasMediaInput[];
    }) {
        const mediaItems = await this.resolveMediaItems({ episodeId, medias });
        const canvas = new Canvas({ episodeId });

        await this.canvasRepository.save([canvas]);
        const canvasMedias = mediaItems.map((mediaItem, index) => {
            const canvasMedia = new CanvasMedia({
                canvasId: canvas.id,
                mediaId: mediaItem.id,
                index: medias[index]?.index,
            });
            canvasMedia.canvas = canvas;
            canvasMedia.media = mediaItem;

            return canvasMedia;
        });

        if (canvasMedias.length > 0) {
            await this.canvasMediaRepository.save(canvasMedias);
        }
        canvas.canvasMedias = canvasMedias;

        return toCanvasDetail(canvas, canvasMedias);
    }

    async list({ episodeId }: { episodeId: number }) {
        const [canvases, total] = await Promise.all([
            this.canvasRepository.find({ episodeId }, { relations: { canvasMedias: { media: true } } }),
            this.canvasRepository.count({ episodeId }),
        ]);
        const items = canvases
            .map((canvas) => {
                const canvasMedias = [...canvas.canvasMedias].sort(
                    (a, b) =>
                        (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER) ||
                        a.media.id - b.media.id
                );
                const [canvasMedia] = canvasMedias;
                const media = canvasMedia?.media;

                return {
                    id: canvas.id,
                    episodeId: canvas.episodeId,
                    mediaId: media?.id,
                    mediaName: media?.mediaName,
                    mediaType: media?.mediaType,
                    mediaUrl: media?.mediaUrl,
                    index: canvasMedia?.index,
                    medias: canvasMedias.map((canvasMediaItem) => ({
                        mediaId: canvasMediaItem.media.id,
                        mediaName: canvasMediaItem.media.mediaName,
                        mediaType: canvasMediaItem.media.mediaType,
                        mediaUrl: canvasMediaItem.media.mediaUrl,
                        ...(typeof canvasMediaItem.media.duration === 'number'
                            ? { duration: canvasMediaItem.media.duration }
                            : {}),
                        index: canvasMediaItem.index,
                    })),
                };
            })
            .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));

        return { items, total };
    }

    async update({
        episodeId,
        canvasId,
        medias,
    }: {
        episodeId: number;
        canvasId: number;
        medias: CanvasMediaInput[];
    }) {
        const [canvas] = await this.canvasRepository.find({ id: canvasId, episodeId });

        if (!canvas) {
            throw new NotFoundException('Canvas not found.');
        }

        const mediaItems = await this.resolveMediaItems({ episodeId, medias });
        const existingCanvasMedias = await this.canvasMediaRepository.find({ canvasId: canvas.id });
        if (existingCanvasMedias.length > 0) {
            await this.canvasMediaRepository.softRemove(existingCanvasMedias);
        }
        const canvasMedias = mediaItems.map((mediaItem, index) => {
            const canvasMedia = new CanvasMedia({
                canvasId: canvas.id,
                mediaId: mediaItem.id,
                index: medias[index]?.index,
            });
            canvasMedia.canvas = canvas;
            canvasMedia.media = mediaItem;

            return canvasMedia;
        });

        if (canvasMedias.length > 0) {
            await this.canvasMediaRepository.save(canvasMedias);
        }
    }

    private async resolveMediaItems({ episodeId, medias }: { episodeId: number; medias: CanvasMediaInput[] }) {
        return Promise.all(
            medias.map(async (media) => {
                const mediaItem = await this.mediaRepository.findOneByEpisodeId({ episodeId, mediaId: media.mediaId });

                if (!mediaItem) {
                    throw new NotFoundException('Media not found.');
                }

                return mediaItem;
            })
        );
    }
}

function toCanvasDetail(canvas: Canvas, canvasMedias: CanvasMedia[]) {
    return {
        id: canvas.id,
        episodeId: canvas.episodeId,
        medias: canvasMedias.map((canvasMedia) => ({
            id: canvasMedia.media.id,
            episodeId: canvasMedia.media.episodeId,
            canvasId: canvas.id,
            mediaName: canvasMedia.media.mediaName,
            mediaType: canvasMedia.media.mediaType,
            mediaUrl: canvasMedia.media.mediaUrl,
            ...(typeof canvasMedia.media.duration === 'number' ? { duration: canvasMedia.media.duration } : {}),
            index: canvasMedia.index,
        })),
    };
}
