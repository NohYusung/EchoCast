import { Injectable } from '@nestjs/common';
import { DddRepository } from '../../../libs/ddd';
import { stripUndefined } from '../../../libs/utils/helper';
import { convertOptions, type TypeormRelationOptions } from '../../../libs/utils/typeorm';
import { Artist } from '../domain/artist.entity';

@Injectable()
export class ArtistRepository extends DddRepository<Artist> {
    entityClass = Artist;

    async find(conditions: { id?: number; name?: string }, options?: TypeormRelationOptions<Artist>) {
        return this.entityManager.find(this.entityClass, {
            where: stripUndefined<Artist>({
                id: conditions.id,
                name: conditions.name,
            }),
            ...convertOptions(options),
        });
    }

    async count(conditions: { id?: number; name?: string }) {
        return this.entityManager.count(this.entityClass, {
            where: stripUndefined<Artist>({
                id: conditions.id,
                name: conditions.name,
            }),
        });
    }
}
