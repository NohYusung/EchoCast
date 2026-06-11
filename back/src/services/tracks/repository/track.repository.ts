import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { stripUndefined } from '../../../libs/utils/helper';
import { Track, type TrackType } from '../domain/track.entity';

@Injectable()
export class TrackRepository extends DddRepository<Track> {
    entityClass = Track;

    async find(
        conditions: {
            id?: number;
            episodeId?: number;
            name?: string;
            type?: TrackType;
            characterId?: number;
            isMuted?: boolean;
        },
        options?: TypeormRelationOptions<Track>
    ) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Track>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                name: conditions.name,
                type: conditions.type,
                characterId: conditions.characterId,
                isMuted: conditions.isMuted,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: {
        id?: number;
        episodeId?: number;
        name?: string;
        type?: TrackType;
        characterId?: number;
        isMuted?: boolean;
    }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Track>({
                id: conditions.id,
                episodeId: conditions.episodeId,
                name: conditions.name,
                type: conditions.type,
                characterId: conditions.characterId,
                isMuted: conditions.isMuted,
            }),
        });
    }
}
