import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioProductMediaDashboard.tsx', import.meta.url), 'utf8');
const iconSource = readFileSync(new URL('../StudioCatalogIcon.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('canvas media source list renders every visual media item', () => {
    const sourceListMatch = source.match(
        /<div className="tp-canvas-source-list">([\s\S]*?)<\/div>\s*<\/div>\s*<\/aside>/
    );

    assert.ok(sourceListMatch);
    assert.match(source, /return mediaItems\.filter\(\(media\) => media\.mediaType !== 'audio'\);/);
    assert.match(sourceListMatch[1] ?? '', /canvasSourceMediaItems\.map/);
    assert.doesNotMatch(sourceListMatch[1] ?? '', /\.slice\(0,\s*8\)/);
});

test('canvas media source list supports batch resource selection', () => {
    assert.match(source, /canvasResourceSelectionIds/);
    assert.match(source, /selectedCanvasResourceIds/);
    assert.match(source, /selectAllCanvasResources/);
    assert.match(source, /addSelectedCanvasResources/);
    assert.match(source, /선택 추가/);
    assert.match(source, /className=\{`tp-canvas-source-row/);
    assert.match(source, /onClick=\{\(\) =>\s*toggleCanvasResourceSelection\(media\.id\)/);
    assert.match(source, /aria-label=\{`\$\{media\.mediaName\} 바로 추가`\}/);
    assert.doesNotMatch(source, /type="checkbox"/);
});

test('canvas stage exposes zoom controls for the strip preview', () => {
    assert.match(source, /const \[canvasStripScale,\s*setCanvasStripScale\] = useState\(100\);/);
    assert.match(source, /const canvasStripWidth = Math\.round\(\(canvasStripBaseWidth \* canvasStripScale\) \/ 100\);/);
    assert.match(source, /function updateCanvasStripScale|const updateCanvasStripScale/);
    assert.match(source, /aria-label="캔버스 확대 축소"[\s\S]*?className="tp-canvas-zoom"[\s\S]*?role="group"/);
    assert.match(source, /aria-label="캔버스 축소"/);
    assert.match(source, /aria-label="캔버스 확대"/);
    assert.match(source, /style=\{canvasStripStyle\}/);
    assert.match(iconSource, /\|\s*'minus'/);
    assert.match(styles, /\.tp-canvas-zoom/);
    assert.match(styles, /width:\s*var\(--tp-canvas-strip-width,\s*236px\);/);
});

test('media registration view includes registered audios but excludes record audios', () => {
    assert.match(source, /Promise\.all\(\[\s*listMedia\(selectedEpisodeId\),\s*listAudios\(selectedEpisodeId\),/);
    assert.ok(source.includes('/episodes/${episodeId}/audios'));
    assert.match(source, /audio\.audioType !== 'record'/);
    assert.match(source, /catalogKey:\s*`audio-\$\{audio\.id\}`/);
});

test('media registration cards open a media preview modal instead of selecting canvas media', () => {
    const mediaGridMatch = source.match(
        /<div className="tp-media-grid tp-media-grid-setup">([\s\S]*?)<\/div>\s*<\/section>\s*\) : null}/
    );

    assert.ok(mediaGridMatch);
    assert.match(source, /const \[previewMedia,\s*setPreviewMedia\] = useState<MediaCatalogItem \| null>\(null\);/);
    assert.match(mediaGridMatch[1] ?? '', /onClick=\{\(\) => openMediaPreview\(media\)\}/);
    assert.doesNotMatch(mediaGridMatch[1] ?? '', /toggleMediaSelection/);
    assert.doesNotMatch(mediaGridMatch[1] ?? '', /tp-media-selected/);
    assert.doesNotMatch(styles, /\.tp-media-selected/);
    assert.match(source, /function MediaPreviewModal/);
    assert.match(source, /<video controls playsInline preload="metadata" src=\{media\.mediaUrl\} \/>/);
    assert.match(source, /<audio controls preload="metadata" src=\{media\.mediaUrl\} \/>/);
});

test('setup panes do not render bottom step navigation actions', () => {
    assert.doesNotMatch(source, /tp-setup-footnav/);
    assert.doesNotMatch(source, />\s*이전\s*<\/button>/);
    assert.doesNotMatch(source, />\s*다음\s*<StudioCatalogIcon/);
    assert.doesNotMatch(source, />\s*타임라인으로\s*<StudioCatalogIcon/);
});

test('dialogue cue creation sends recording duration with the script', () => {
    assert.match(source, /duration:\s*dialogueDurationMs/);
    assert.match(source, /endTime:\s*startTime \+ dialogueDurationMs/);
});
