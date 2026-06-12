import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Audio, type AudioType } from '../domain/audio.entity';

@Injectable()
export class AudioRepository extends DddRepository<Audio> {
    entityClass = Audio;

    async find(
        conditions: {
            id?: number;
            episodeId?: number;
            audioType?: AudioType;
            name?: string;
            audioUrl?: string;
            duration?: number;
        },
        options?: TypeormRelationOptions<Audio>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Audio>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                audioType: conditions.audioType,
                name: conditions.name,
                audioUrl: conditions.audioUrl,
                duration: conditions.duration,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        episodeId?: number;
        audioType?: AudioType;
        name?: string;
        audioUrl?: string;
        duration?: number;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Audio>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                audioType: conditions.audioType,
                name: conditions.name,
                audioUrl: conditions.audioUrl,
                duration: conditions.duration,
            }),
        });
    }

    async findByEpisodeId(episodeId: number) {
        return this.find({ episodeId }, { relations: { cue: true }, options: { sort: 'id', order: 'ASC' } });
    }

    async countByEpisodeId(episodeId: number) {
        return this.count({ episodeId });
    }
}
