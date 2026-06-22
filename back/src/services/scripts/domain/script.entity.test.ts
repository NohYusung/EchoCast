import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { Script } from './script.entity';

describe('Script entity', () => {
    it('stores reusable script line text with recording duration', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [Script],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const metadata = dataSource.getMetadata(Script);
            const columnNames = metadata.columns.map((column) => column.propertyName);

            assert.equal(columnNames.includes('line'), true);
            assert.equal(columnNames.includes('duration'), true);
            assert.equal(columnNames.includes('text'), false);
            assert.equal(columnNames.includes('episodeId'), false);
            assert.equal(columnNames.includes('characterId'), false);
            assert.equal(columnNames.includes('sortOrder'), false);
            assert.equal(metadata.relations.length, 0);

            const script = await dataSource.manager.save(new Script({ line: '대사 라인', duration: 1800 }));
            const storedScript = await dataSource.manager.findOneByOrFail(Script, { id: script.id });

            assert.equal(storedScript.line, '대사 라인');
            assert.equal(storedScript.duration, 1800);
        } finally {
            await dataSource.destroy();
        }
    });
});
