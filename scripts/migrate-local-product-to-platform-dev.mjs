#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';

const ROOT_DIR = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_SOURCE_ENV_PATH = path.join(ROOT_DIR, 'back/.env.local');
const DEFAULT_TARGET_ENV_PATH = '/Users/nes0903/Documents/platform-dev-mcp/.env';
const DEFAULT_TARGET_HOST = 'platform-dev-v3.cl0syga28ddv.ap-northeast-2.rds.amazonaws.com';
const DEFAULT_TARGET_PORT = 3306;
const DEFAULT_TARGET_DATABASE = 'new_dubright';

const MIGRATION_TABLES = [
    'products',
    'episodes',
    'characters',
    'medias',
    'canvases',
    'canvas_medias',
    'tracks',
    'audios',
    'cues',
    'artists',
    'records',
    'anchors',
    'scrolls',
];

const REQUIRED_TARGET_COLUMNS = {
    products: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'title', 'subtitle', 'coverImageUrl'],
    episodes: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'productId', 'episodeNumber', 'title', 'subTitle', 'thumbnailImageUrl', 'defaultCanvasId'],
    characters: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'productId', 'name', 'role', 'imageUrl'],
    medias: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'episodeId', 'mediaName', 'mediaType', 'duration', 'mediaUrl'],
    canvases: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'episodeId'],
    canvas_medias: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'canvasId', 'mediaId', 'index', 'startTime', 'endTime', 'sourceStartTime', 'sourceEndTime', 'volume', 'isMuted'],
    tracks: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'episodeId', 'name', 'type', 'characterId', 'isMuted'],
    audios: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'episodeId', 'audioType', 'name', 'audioUrl', 'duration'],
    cues: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'script', 'characterId', 'trackId', 'audioId', 'startCanvasMediaId', 'endCanvasMediaId', 'startTime', 'endTime', 'audioStartTime', 'audioEndTime', 'startPosition', 'endPosition', 'volume'],
    artists: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'name'],
    records: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'cueId', 'artistId', 'audioId', 'isAccepted'],
    anchors: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'trackId', 'canvasId', 'time', 'position', 'index'],
    scrolls: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'deletedAt', 'id', 'trackId', 'startAnchorId', 'endAnchorId'],
};

function parseArgs(argv) {
    const args = {
        productTitle: '진격의 거인',
        execute: false,
        allowDuplicateTitle: false,
        sourceEnvPath: DEFAULT_SOURCE_ENV_PATH,
        targetEnvPath: DEFAULT_TARGET_ENV_PATH,
    };

    for (let index = 2; index < argv.length; index += 1) {
        const value = argv[index];

        if (value === '--execute') {
            args.execute = true;
            continue;
        }

        if (value === '--allow-duplicate-title') {
            args.allowDuplicateTitle = true;
            continue;
        }

        if (value === '--product-title') {
            args.productTitle = argv[index + 1];
            index += 1;
            continue;
        }

        if (value === '--source-env') {
            args.sourceEnvPath = argv[index + 1];
            index += 1;
            continue;
        }

        if (value === '--target-env') {
            args.targetEnvPath = argv[index + 1];
            index += 1;
            continue;
        }

        throw new Error(`Unknown argument: ${value}`);
    }

    if (!args.productTitle) {
        throw new Error('--product-title 값이 필요합니다.');
    }

    return args;
}

function readEnvFile(envPath) {
    if (!fs.existsSync(envPath)) {
        return {};
    }

    const env = {};
    const text = fs.readFileSync(envPath, 'utf8');

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
    }

    return env;
}

function requireValue(value, label) {
    if (value === undefined || value === null || value === '') {
        throw new Error(`${label} 값이 필요합니다.`);
    }
    return value;
}

function buildSourceConfig(sourceEnv) {
    return {
        host: requireValue(process.env.SOURCE_DB_HOST ?? sourceEnv.NEW_DUBRIGHT_DB_HOST, 'source DB host'),
        port: Number(process.env.SOURCE_DB_PORT ?? sourceEnv.NEW_DUBRIGHT_DB_PORT ?? 3306),
        user: requireValue(process.env.SOURCE_DB_USER ?? sourceEnv.NEW_DUBRIGHT_DB_USERNAME, 'source DB user'),
        password: process.env.SOURCE_DB_PASSWORD ?? sourceEnv.NEW_DUBRIGHT_DB_PASSWORD ?? '',
        database: requireValue(process.env.SOURCE_DB_DATABASE ?? sourceEnv.NEW_DUBRIGHT_DB_DATABASE, 'source DB database'),
        multipleStatements: false,
    };
}

function buildTargetConfig(targetEnv) {
    return {
        host: process.env.TARGET_DB_HOST ?? targetEnv.DB_HOST ?? DEFAULT_TARGET_HOST,
        port: Number(process.env.TARGET_DB_PORT ?? targetEnv.DB_PORT ?? DEFAULT_TARGET_PORT),
        user: requireValue(process.env.TARGET_DB_USER ?? targetEnv.DB_USER, 'target DB user'),
        password: process.env.TARGET_DB_PASSWORD ?? targetEnv.DB_PASSWORD ?? '',
        database: process.env.TARGET_DB_DATABASE ?? targetEnv.DB_NAME ?? DEFAULT_TARGET_DATABASE,
        multipleStatements: false,
    };
}

function q(identifier) {
    return `\`${identifier}\``;
}

function plainRow(row) {
    return Object.fromEntries(Object.entries(row));
}

function ids(rows) {
    return rows.map((row) => row.id);
}

function nonNullUnique(values) {
    return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function idMap() {
    return new Map();
}

function mappedValue(map, value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (!map.has(value)) {
        throw new Error(`ID mapping not found for ${value}`);
    }

    return map.get(value);
}

async function queryRows(connection, sql, params = []) {
    const [rows] = await connection.query(sql, params);
    return rows.map(plainRow);
}

async function queryIn(connection, sqlPrefix, values) {
    if (values.length === 0) {
        return [];
    }

    const placeholders = values.map(() => '?').join(', ');
    return queryRows(connection, `${sqlPrefix} (${placeholders})`, values);
}

async function fetchColumns(connection, database, table) {
    const rows = await queryRows(
        connection,
        `
            SELECT COLUMN_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `,
        [database, table],
    );

    return rows.map((row) => row.COLUMN_NAME);
}

async function assertTargetSchema(connection, database) {
    const mismatches = [];

    for (const table of MIGRATION_TABLES) {
        const actualColumns = new Set(await fetchColumns(connection, database, table));
        const missingColumns = REQUIRED_TARGET_COLUMNS[table].filter((column) => !actualColumns.has(column));

        if (missingColumns.length > 0) {
            mismatches.push(`${table}: ${missingColumns.join(', ')}`);
        }
    }

    if (mismatches.length > 0) {
        throw new Error(`Target schema mismatch:\n${mismatches.join('\n')}`);
    }
}

async function fetchSourceGraph(source, productTitle) {
    const products = await queryRows(source, 'SELECT * FROM `products` WHERE `title` = ?', [productTitle]);

    if (products.length === 0) {
        throw new Error(`source product not found: ${productTitle}`);
    }

    if (products.length > 1) {
        throw new Error(`source product title is not unique: ${productTitle}`);
    }

    const product = products[0];
    const episodes = await queryRows(source, 'SELECT * FROM `episodes` WHERE `productId` = ? ORDER BY `id`', [product.id]);
    const episodeIds = ids(episodes);
    const characters = await queryRows(source, 'SELECT * FROM `characters` WHERE `productId` = ? ORDER BY `id`', [product.id]);
    const medias = await queryIn(source, 'SELECT * FROM `medias` WHERE `episodeId` IN', episodeIds);
    const canvases = await queryIn(source, 'SELECT * FROM `canvases` WHERE `episodeId` IN', episodeIds);
    const tracks = await queryIn(source, 'SELECT * FROM `tracks` WHERE `episodeId` IN', episodeIds);
    const canvasMedias = await queryIn(source, 'SELECT * FROM `canvas_medias` WHERE `canvasId` IN', ids(canvases));
    const cues = await queryIn(source, 'SELECT * FROM `cues` WHERE `trackId` IN', ids(tracks));
    const anchors = await queryIn(source, 'SELECT * FROM `anchors` WHERE `trackId` IN', ids(tracks));
    const scrolls = await queryIn(source, 'SELECT * FROM `scrolls` WHERE `trackId` IN', ids(tracks));
    const records = await queryIn(source, 'SELECT * FROM `records` WHERE `cueId` IN', ids(cues));

    const audioIds = nonNullUnique([
        ...cues.map((cue) => cue.audioId),
        ...records.map((record) => record.audioId),
    ]);
    const episodeAudios = await queryIn(source, 'SELECT * FROM `audios` WHERE `episodeId` IN', episodeIds);
    const referencedAudios = await queryIn(source, 'SELECT * FROM `audios` WHERE `id` IN', audioIds);
    const audioById = new Map([...episodeAudios, ...referencedAudios].map((audio) => [audio.id, audio]));
    const audios = [...audioById.values()].sort((left, right) => left.id - right.id);

    const artistIds = nonNullUnique(records.map((record) => record.artistId));
    const artists = await queryIn(source, 'SELECT * FROM `artists` WHERE `id` IN', artistIds);

    return {
        product,
        episodes,
        characters,
        medias,
        canvases,
        canvasMedias,
        tracks,
        audios,
        cues,
        artists,
        records,
        anchors,
        scrolls,
    };
}

async function assertNoTargetDuplicate(target, productTitle, allowDuplicateTitle) {
    if (allowDuplicateTitle) {
        return;
    }

    const existing = await queryRows(target, 'SELECT `id`, `title` FROM `products` WHERE `title` = ?', [productTitle]);
    if (existing.length > 0) {
        throw new Error(`target already has product title "${productTitle}". Use --allow-duplicate-title to insert anyway.`);
    }
}

async function insertRow(connection, table, sourceRow, overrides = {}) {
    const row = {
        ...sourceRow,
        ...overrides,
    };
    delete row.id;

    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((column) => row[column]);
    const [result] = await connection.execute(
        `INSERT INTO ${q(table)} (${columns.map(q).join(', ')}) VALUES (${placeholders})`,
        values,
    );

    return result.insertId;
}

async function insertMappedRows(connection, table, rows, map, buildOverrides) {
    for (const row of rows) {
        const overrides = buildOverrides(row);
        const insertedId = await insertRow(connection, table, row, overrides);
        map.set(row.id, insertedId);
    }
}

function printSummary(graph, execute) {
    console.log(JSON.stringify({
        mode: execute ? 'execute' : 'dry-run',
        product: {
            id: graph.product.id,
            title: graph.product.title,
        },
        counts: {
            products: 1,
            episodes: graph.episodes.length,
            characters: graph.characters.length,
            medias: graph.medias.length,
            canvases: graph.canvases.length,
            canvas_medias: graph.canvasMedias.length,
            tracks: graph.tracks.length,
            audios: graph.audios.length,
            cues: graph.cues.length,
            artists: graph.artists.length,
            records: graph.records.length,
            anchors: graph.anchors.length,
            scrolls: graph.scrolls.length,
        },
    }, null, 2));
}

async function migrateGraph(target, graph) {
    const productMap = idMap();
    const episodeMap = idMap();
    const characterMap = idMap();
    const mediaMap = idMap();
    const canvasMap = idMap();
    const canvasMediaMap = idMap();
    const trackMap = idMap();
    const audioMap = idMap();
    const cueMap = idMap();
    const artistMap = idMap();
    const recordMap = idMap();
    const anchorMap = idMap();
    const scrollMap = idMap();

    await target.beginTransaction();

    try {
        productMap.set(graph.product.id, await insertRow(target, 'products', graph.product));

        await insertMappedRows(target, 'episodes', graph.episodes, episodeMap, (episode) => ({
            productId: mappedValue(productMap, episode.productId),
            defaultCanvasId: null,
        }));

        await insertMappedRows(target, 'characters', graph.characters, characterMap, (character) => ({
            productId: mappedValue(productMap, character.productId),
        }));

        await insertMappedRows(target, 'medias', graph.medias, mediaMap, (media) => ({
            episodeId: mappedValue(episodeMap, media.episodeId),
        }));

        await insertMappedRows(target, 'canvases', graph.canvases, canvasMap, (canvas) => ({
            episodeId: mappedValue(episodeMap, canvas.episodeId),
        }));

        await insertMappedRows(target, 'canvas_medias', graph.canvasMedias, canvasMediaMap, (canvasMedia) => ({
            canvasId: mappedValue(canvasMap, canvasMedia.canvasId),
            mediaId: mappedValue(mediaMap, canvasMedia.mediaId),
        }));

        await insertMappedRows(target, 'tracks', graph.tracks, trackMap, (track) => ({
            episodeId: mappedValue(episodeMap, track.episodeId),
            characterId: mappedValue(characterMap, track.characterId),
        }));

        await insertMappedRows(target, 'audios', graph.audios, audioMap, (audio) => ({
            episodeId: mappedValue(episodeMap, audio.episodeId),
        }));

        await insertMappedRows(target, 'cues', graph.cues, cueMap, (cue) => ({
            characterId: mappedValue(characterMap, cue.characterId),
            trackId: mappedValue(trackMap, cue.trackId),
            audioId: mappedValue(audioMap, cue.audioId),
            startCanvasMediaId: mappedValue(canvasMediaMap, cue.startCanvasMediaId),
            endCanvasMediaId: mappedValue(canvasMediaMap, cue.endCanvasMediaId),
        }));

        await insertMappedRows(target, 'artists', graph.artists, artistMap, () => ({}));

        await insertMappedRows(target, 'records', graph.records, recordMap, (record) => ({
            cueId: mappedValue(cueMap, record.cueId),
            artistId: mappedValue(artistMap, record.artistId),
            audioId: mappedValue(audioMap, record.audioId),
        }));

        await insertMappedRows(target, 'anchors', graph.anchors, anchorMap, (anchor) => ({
            trackId: mappedValue(trackMap, anchor.trackId),
            canvasId: mappedValue(canvasMap, anchor.canvasId),
        }));

        await insertMappedRows(target, 'scrolls', graph.scrolls, scrollMap, (scroll) => ({
            trackId: mappedValue(trackMap, scroll.trackId),
            startAnchorId: mappedValue(anchorMap, scroll.startAnchorId),
            endAnchorId: mappedValue(anchorMap, scroll.endAnchorId),
        }));

        for (const episode of graph.episodes) {
            if (episode.defaultCanvasId === null || episode.defaultCanvasId === undefined) {
                continue;
            }

            await target.execute(
                'UPDATE `episodes` SET `defaultCanvasId` = ? WHERE `id` = ?',
                [mappedValue(canvasMap, episode.defaultCanvasId), mappedValue(episodeMap, episode.id)],
            );
        }

        await target.commit();

        return {
            productId: mappedValue(productMap, graph.product.id),
            episodeIds: [...episodeMap.values()],
            recordIds: [...recordMap.values()],
        };
    } catch (error) {
        await target.rollback();
        throw error;
    }
}

async function main() {
    const args = parseArgs(process.argv);
    const sourceEnv = readEnvFile(args.sourceEnvPath);
    const targetEnv = readEnvFile(args.targetEnvPath);
    const sourceConfig = buildSourceConfig(sourceEnv);
    const targetConfig = buildTargetConfig(targetEnv);

    const source = await mysql.createConnection(sourceConfig);
    const target = await mysql.createConnection(targetConfig);

    try {
        await assertTargetSchema(target, targetConfig.database);
        await assertNoTargetDuplicate(target, args.productTitle, args.allowDuplicateTitle);

        const graph = await fetchSourceGraph(source, args.productTitle);
        printSummary(graph, args.execute);

        if (!args.execute) {
            console.log('Dry-run only. Add --execute to insert into target DB.');
            return;
        }

        const result = await migrateGraph(target, graph);
        console.log(JSON.stringify({
            migrated: true,
            target: {
                database: targetConfig.database,
                productId: result.productId,
                episodeIds: result.episodeIds,
                recordIds: result.recordIds,
            },
        }, null, 2));
    } finally {
        await source.end().catch(() => {});
        await target.end().catch(() => {});
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
