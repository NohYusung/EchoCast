import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';
import { User } from './user.entity';

describe('User entity', () => {
    it('stores app user profile fields and updates changed values', async () => {
        const dataSource = new DataSource({
            type: 'sqljs',
            entities: [User],
            synchronize: true,
            logging: false,
        });
        await dataSource.initialize();

        try {
            const metadata = dataSource.getMetadata(User);
            const columnNames = metadata.columns.map((column) => column.propertyName);

            assert.equal(columnNames.includes('id'), true);
            assert.equal(columnNames.includes('email'), true);
            assert.equal(columnNames.includes('password'), true);
            assert.equal(columnNames.includes('name'), true);
            assert.equal(columnNames.includes('nickname'), true);
            assert.equal(columnNames.includes('profileImageUrl'), true);
            assert.equal(columnNames.includes('status'), true);
            assert.equal(
                metadata.uniques.some((unique) => unique.columns.some((column) => column.propertyName === 'email')),
                true
            );

            const user = await dataSource.manager.save(
                new User({
                    email: 'studio-user@example.com',
                    password: 'initial-password',
                    name: '스튜디오 유저',
                    nickname: 'studio',
                    profileImageUrl: 'https://assets.example.com/profile.png',
                })
            );

            user.update({
                name: '수정된 유저',
                status: 'inactive',
            });
            user.updatePassword({ password: 'changed-password' });
            await dataSource.manager.save(user);

            const storedUser = await dataSource.manager.findOneByOrFail(User, { id: user.id });
            assert.equal(storedUser.email, 'studio-user@example.com');
            assert.equal(storedUser.password, 'changed-password');
            assert.equal(storedUser.name, '수정된 유저');
            assert.equal(storedUser.nickname, 'studio');
            assert.equal(storedUser.profileImageUrl, 'https://assets.example.com/profile.png');
            assert.equal(storedUser.status, 'inactive');
        } finally {
            await dataSource.destroy();
        }
    });
});
