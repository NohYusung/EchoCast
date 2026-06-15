import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtistService } from './artist.service';
import type { ArtistRepository } from '../repository/artist.repository';
import type { Artist } from '../domain/artist.entity';

test('ArtistService.create saves an artist and returns the created summary', async () => {
    const savedArtists: Artist[] = [];
    const service = new ArtistService({
        save: async (artists: Artist[]) => {
            artists.forEach((artist, index) => {
                artist.id = index + 1;
                savedArtists.push(artist);
            });
            return artists;
        },
    } as unknown as ArtistRepository);

    const result = await service.create({ name: '테스트 성우' });

    assert.deepEqual(result, { id: 1, name: '테스트 성우' });
    assert.equal(savedArtists.length, 1);
    assert.equal(savedArtists[0].name, '테스트 성우');
});

test('ArtistService.list returns items and total from the repository', async () => {
    const service = new ArtistService({
        find: async () =>
            [
                {
                    id: 3,
                    name: '목록 성우',
                },
            ] as Artist[],
        count: async () => 1,
    } as unknown as ArtistRepository);

    const result = await service.list();

    assert.deepEqual(result, {
        items: [{ id: 3, name: '목록 성우' }],
        total: 1,
    });
});
