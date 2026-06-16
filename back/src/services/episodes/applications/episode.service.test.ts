import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Character } from '../../characters/domain/character.entity';
import { Product } from '../../products/domain/product.entity';
import { Episode } from '../domain/episode.entity';
import { EpisodeRepository } from '../repository/episode.repository';
import { EpisodeService } from './episode.service';

describe('EpisodeService', () => {
    it('creates and updates episode thumbnail image URL', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product, Episode],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const episodeRepository = new EpisodeRepository(dataSource);
            const episodeService = new EpisodeService(episodeRepository);
            const product = await dataSource.manager.save(
                new Product({
                    title: 'Episode thumbnail product',
                })
            );

            await episodeService.create({
                productId: product.id,
                episodeNumber: 1,
                title: 'Before episode title',
                subTitle: 'Before subtitle',
                thumbnailImageUrl: 'https://assets.example.com/episodes/before.png',
                defaultCanvasId: 11,
            });

            const createdEpisodes = await episodeService.list({ productId: product.id });
            const episode = createdEpisodes.items[0];
            assert.equal(episode.thumbnailImageUrl, 'https://assets.example.com/episodes/before.png');
            assert.equal(episode.defaultCanvasId, 11);

            await episodeService.update({
                productId: product.id,
                episodeId: episode.id,
                title: 'After episode title',
                thumbnailImageUrl: 'https://assets.example.com/episodes/after.png',
                defaultCanvasId: 12,
            });

            const updatedEpisode = await episodeService.retrieve({ productId: product.id, episodeId: episode.id });

            assert.equal(updatedEpisode.id, episode.id);
            assert.equal(updatedEpisode.productId, product.id);
            assert.equal(updatedEpisode.episodeNumber, 1);
            assert.equal(updatedEpisode.title, 'After episode title');
            assert.equal(updatedEpisode.subTitle, 'Before subtitle');
            assert.equal(updatedEpisode.thumbnailImageUrl, 'https://assets.example.com/episodes/after.png');
            assert.equal(updatedEpisode.defaultCanvasId, 12);
        } finally {
            await dataSource.destroy();
        }
    });

    it('throws NotFoundException when updating a missing episode', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Character, Product, Episode],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const episodeRepository = new EpisodeRepository(dataSource);
            const episodeService = new EpisodeService(episodeRepository);

            await assert.rejects(
                () =>
                    episodeService.update({
                        productId: 1,
                        episodeId: 9999,
                        thumbnailImageUrl: 'https://assets.example.com/episodes/missing.png',
                    }),
                (error: unknown) => error instanceof NotFoundException
            );
        } finally {
            await dataSource.destroy();
        }
    });
});
