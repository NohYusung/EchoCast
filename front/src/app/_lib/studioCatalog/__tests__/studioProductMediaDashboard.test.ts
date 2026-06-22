import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioProductMediaDashboard.tsx', import.meta.url), 'utf8');
const iconSource = readFileSync(new URL('../StudioCatalogIcon.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('canvas media source list renders every visual media item', () => {
    const sourceListStart = source.indexOf('<div className="tp-canvas-source-list">');
    const sourceListEnd = source.indexOf('</aside>', sourceListStart);
    const sourceListSnippet =
        sourceListStart >= 0 && sourceListEnd > sourceListStart ? source.slice(sourceListStart, sourceListEnd) : '';

    assert.ok(sourceListSnippet);
    assert.match(source, /return mediaItems\.filter\(\(media\) => media\.mediaType !== 'audio'\);/);
    assert.match(sourceListSnippet, /canvasSourceMediaItems\.map/);
    assert.doesNotMatch(sourceListSnippet, /\.slice\(0,\s*8\)/);
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

test('canvas stage exposes dialogue cue placement and inspector fields', () => {
    const stageHeadStart = source.indexOf('<div className="tp-canvas-stage-head">');
    const stageHeadEnd = source.indexOf('<div\n                                                        className={', stageHeadStart);
    const stageHeadSnippet =
        stageHeadStart >= 0 && stageHeadEnd > stageHeadStart ? source.slice(stageHeadStart, stageHeadEnd) : '';

    assert.ok(stageHeadSnippet);
    assert.match(source, /const \[isCanvasDialogueMode,\s*setIsCanvasDialogueMode\] = useState\(false\);/);
    assert.match(source, /const canvasDialogueStripRef = useRef<HTMLDivElement \| null>\(null\);/);
    assert.match(source, /toggleCanvasDialogueMode/);
    assert.match(source, /selectCanvasDialogueCuePosition/);
    assert.match(source, /stripRoot\?\.matches\('\[data-dialogue-strip-stack\]'\)/);
    assert.match(stageHeadSnippet, /className="tp-canvas-tools" role="toolbar"[\s\S]*?>\s*대사\s*<\/button>/);
    assert.ok(stageHeadSnippet.indexOf('className="tp-canvas-tools"') < stageHeadSnippet.indexOf('className="tp-canvas-zoom"'));
    assert.doesNotMatch(stageHeadSnippet, /<h1>|스트립 \{canvases\.findIndex/);
    assert.match(source, /className="tp-canvas-dialogue-form"/);
    assert.match(source, /aria-label="캔버스 대사 삽입 컷"/);
    assert.match(source, /aria-label="캔버스 대사 삽입 위치값"/);
    assert.match(source, /aria-label="캔버스 대사 녹음 길이"/);
    assert.match(source, /data-dialogue-strip-stack/);
    assert.match(source, /ref=\{canvasDialogueStripRef\}/);
    assert.match(source, /onClick=\{selectCanvasDialogueCuePosition\}/);
    assert.match(source, /const mediaCueRows = visibleDialogueRows\.filter/);
    assert.match(source, /className="tp-dialogue-strip-cue"/);
    assert.match(source, /toDialogueCueOverlayTop\(cue\.startPosition\)/);
    assert.match(source, /className="tp-dialogue-strip-more"/);
    assert.match(styles, /\.tp-canvas-tool\.is-active/);
    assert.match(styles, /\.tp-canvas-dialogue-form/);
    assert.match(styles, /\.tp-strip-block\.is-dialogue-target/);
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
