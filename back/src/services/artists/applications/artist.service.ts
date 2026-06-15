import { Injectable } from '@nestjs/common';
import { DddService } from '../../../libs/ddd';
import { Artist } from '../domain/artist.entity';
import { ArtistRepository } from '../repository/artist.repository';

@Injectable()
export class ArtistService extends DddService {
    constructor(private readonly artistRepository: ArtistRepository) {
        super();
    }

    async create({ name }: { name: string }) {
        const artist = new Artist({ name });

        await this.artistRepository.save([artist]);

        return {
            id: artist.id,
            name: artist.name,
        };
    }

    async list() {
        const [artists, total] = await Promise.all([this.artistRepository.find({}), this.artistRepository.count({})]);
        const items = artists.map((artist) => ({
            id: artist.id,
            name: artist.name,
        }));

        return { items, total };
    }
}
