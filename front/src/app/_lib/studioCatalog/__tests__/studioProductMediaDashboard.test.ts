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
    assert.match(source, /const canvasStripMaxScale = 400;/);
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

test('canvas stage exposes cue placement modes and inspector fields', () => {
    const stageHeadStart = source.indexOf('<div className="tp-canvas-stage-head">');
    const stageHeadEnd = source.indexOf('<div\n                                                        className={', stageHeadStart);
    const stageHeadSnippet =
        stageHeadStart >= 0 && stageHeadEnd > stageHeadStart ? source.slice(stageHeadStart, stageHeadEnd) : '';

    assert.ok(stageHeadSnippet);
    assert.match(source, /type CanvasCueMode = 'dialogue' \| 'effect' \| 'bgm';/);
    assert.match(source, /const \[activeCanvasCueMode,\s*setActiveCanvasCueMode\] = useState<CanvasCueMode \| null>\(null\);/);
    assert.match(source, /const canvasCueModeDefinitions: CanvasCueModeDefinition\[\] = \[/);
    assert.match(source, /label: '대사'/);
    assert.match(source, /label: '효과음'/);
    assert.match(source, /label: '배경음'/);
    assert.match(source, /const canvasDialogueStripRef = useRef<HTMLDivElement \| null>\(null\);/);
    assert.match(source, /type CueUpdateRequest = Partial<CueCreateRequest> & \{\s*targetTrackId\?: number;\s*\};/);
    assert.match(source, /toggleCanvasCueMode/);
    assert.match(source, /createCanvasCue/);
    assert.match(source, /ensureCanvasAudioCueTrack/);
    assert.match(source, /selectCanvasDialogueCuePosition/);
    assert.match(source, /const \[canvasCueDragState,\s*setCanvasCueDragState\] = useState<CanvasCueDragState \| null>\(null\);/);
    assert.match(source, /resolveDialogueCuePositionFromStrip/);
    assert.match(source, /startCanvasCueDrag/);
    assert.match(source, /moveCanvasCueDrag/);
    assert.match(source, /endCanvasCueDrag/);
    assert.match(source, /cancelCanvasCueDrag/);
    assert.match(source, /window\.addEventListener\('pointermove', moveOnWindow, \{ passive: false \}\);/);
    assert.match(source, /window\.addEventListener\('pointerup', endOnWindow, \{ passive: false \}\);/);
    assert.match(source, /window\.addEventListener\('pointercancel', cancelOnWindow, \{ passive: false \}\);/);
    assert.match(source, /await updateCue\(String\(finishedDragState\.trackId\), String\(finishedDragState\.cueId\), nextPosition\);/);
    assert.match(source, /stripRoot\?\.matches\('\[data-dialogue-strip-stack\]'\)/);
    assert.match(stageHeadSnippet, /canvasCueModeDefinitions\.map/);
    assert.match(stageHeadSnippet, /toggleCanvasCueMode\(definition\.id\)/);
    assert.match(stageHeadSnippet, /\{definition\.label\}/);
    assert.ok(stageHeadSnippet.indexOf('className="tp-canvas-tools"') < stageHeadSnippet.indexOf('className="tp-canvas-zoom"'));
    assert.doesNotMatch(stageHeadSnippet, /<h1>|스트립 \{canvases\.findIndex/);
    assert.match(source, /className="tp-canvas-dialogue-form"/);
    assert.match(source, /onSubmit=\{createCanvasCue\}/);
    assert.match(source, /aria-label=\{`캔버스 \$\{activeCanvasCueDefinition\.label\} 삽입 컷`\}/);
    assert.match(source, /aria-label=\{`캔버스 \$\{activeCanvasCueDefinition\.label\} 삽입 위치값`\}/);
    assert.match(source, /\? '캔버스 대사 녹음 길이'\s*:\s*`캔버스 \$\{activeCanvasCueDefinition\.label\} 길이`/);
    assert.match(source, /data-dialogue-strip-stack/);
    assert.match(source, /ref=\{canvasDialogueStripRef\}/);
    assert.match(source, /const canvasCueRows = useMemo/);
    assert.match(source, /const mediaCueRows = canvasCueRows\.filter/);
    assert.match(source, /toDialogueCueOverlayPlacements/);
    assert.match(source, /const mediaCuePlacements = new Map/);
    assert.match(source, /className="tp-strip-dialogue-row"/);
    assert.doesNotMatch(source, /className="tp-strip-label"/);
    assert.match(source, /className="tp-canvas-dialogue-image-hitarea"/);
    assert.match(source, /onClick=\{selectCanvasDialogueCuePosition\}/);
    assert.match(source, /className="tp-canvas-dialogue-line"/);
    assert.match(source, /<div\s+className="tp-canvas-dialogue-line"[\s\S]*?\{dialogueLineContent\}[\s\S]*?<\/div>[\s\S]*?<div className="tp-strip-controls">/);
    assert.match(source, /aria-label=\{`\$\{media\.mediaName\} 큐 위치 선택`\}/);
    assert.doesNotMatch(source, /tp-canvas-dialogue-line is-placement-enabled/);
    assert.doesNotMatch(source, /dialogueTrackLanes/);
    assert.match(source, /className="tp-dialogue-strip-cue"/);
    assert.match(source, /className="tp-dialogue-strip-cue-head"/);
    assert.match(source, />컷 \{index \+ 1\}<\/small>/);
    assert.match(source, /'--tp-dialogue-cue-accent'/);
    assert.match(source, /'--tp-dialogue-cue-offset'/);
    assert.match(source, /'--tp-dialogue-cue-connector-width'/);
    assert.match(source, /const mediaCueOverlayItems = mediaCueRows\.map/);
    assert.match(source, /className="tp-dialogue-strip-cue-connector"/);
    assert.ok(
        source.indexOf('className="tp-dialogue-strip-cue-connector"') <
            source.indexOf('const isDraggingCanvasCue')
    );
    assert.match(source, /onPointerDown=\{\(event\) =>\s*startCanvasCueDrag/);
    assert.doesNotMatch(source, /tp-canvas-dialogue-line-label/);
    assert.match(source, /toDialogueCueOverlayTop\(cue\.startPosition\)/);
    assert.doesNotMatch(source, /캔버스에서 대사를 넣을 위치를 선택해 주세요/);
    assert.match(iconSource, /\|\s*'volume'/);
    assert.match(iconSource, /\|\s*'music'/);
    assert.match(styles, /min-height:\s*34px;[\s\S]*?font-size:\s*13px;[\s\S]*?padding:\s*0 13px;/);
    assert.match(styles, /\.tp-canvas-tool\.is-active/);
    assert.match(styles, /\.tp-canvas-dialogue-form/);
    assert.match(styles, /\.tp-strip-block\.is-dialogue-target/);
    assert.match(styles, /\.tp-strip-block\.is-dialogue-target\.is-placement-enabled/);
    assert.match(styles, /\.tp-strip-stack\.is-dialogue-placement/);
    assert.doesNotMatch(styles, /grid-template-columns:\s*var\(--tp-canvas-strip-width,\s*236px\)\s+\d+px;/);
    assert.match(styles, /\.tp-strip-stack\.is-dialogue-placement\s*\{[\s\S]*?width:\s*var\(--tp-canvas-strip-width,\s*236px\);/);
    assert.match(styles, /\.tp-strip-dialogue-row\s*\{[\s\S]*?display:\s*block;/);
    assert.doesNotMatch(styles, /\.tp-strip-label/);
    assert.match(styles, /\.tp-canvas-dialogue-line/);
    assert.match(styles, /\.tp-canvas-dialogue-line\s*\{[\s\S]*?position:\s*absolute;/);
    assert.match(styles, /background:\s*transparent;/);
    assert.match(styles, /var\(--tp-dialogue-cue-accent,\s*#2dd4bf\)/);
    assert.match(
        styles,
        /\.tp-canvas-dialogue-line \.tp-dialogue-strip-cue\s*\{[\s\S]*?top:\s*var\(--tp-dialogue-cue-top,\s*50%\);/
    );
    assert.match(styles, /left:\s*calc\(100% \+ var\(--tp-dialogue-cue-offset,\s*18px\)\);/);
    assert.match(styles, /\.tp-canvas-dialogue-line \.tp-dialogue-strip-cue::before/);
    assert.match(styles, /right:\s*100%;[\s\S]*?width:\s*18px;/);
    assert.match(styles, /width:\s*var\(--tp-dialogue-cue-connector-width,\s*16px\);/);
    assert.match(
        styles,
        /\.tp-canvas-dialogue-line \.tp-dialogue-strip-cue\s*\{[\s\S]*?z-index:\s*3;/
    );
    assert.match(styles, /cursor:\s*grab;/);
    assert.match(styles, /touch-action:\s*none;/);
    assert.match(styles, /\.tp-canvas-dialogue-line \.tp-dialogue-strip-cue\.is-dragging/);
    assert.match(styles, /cursor:\s*grabbing;/);
    assert.match(
        styles,
        /\.tp-canvas-dialogue-line \.tp-dialogue-strip-cue-connector\s*\{[\s\S]*?z-index:\s*1;/
    );
    assert.doesNotMatch(styles, /\.tp-canvas-dialogue-line-label/);
    assert.match(styles, /\.tp-canvas-dialogue-image-hitarea/);
    assert.doesNotMatch(styles, /\.tp-canvas-dialogue-line\.is-placement-enabled/);
    assert.doesNotMatch(styles, /\.tp-canvas-dialogue-track-lane/);
});

test('canvas stage exposes Open Design style cue filters', () => {
    assert.match(source, /type CanvasCueFilterId = 'dialogue' \| 'effect' \| 'bgm';/);
    assert.match(source, /const canvasCueFilterDefinitions: CanvasCueFilterDefinition\[\] = \[/);
    assert.match(source, /label: '대사'/);
    assert.match(source, /label: '효과음'/);
    assert.match(source, /label: '배경음'/);
    assert.doesNotMatch(source, /label: '내레이션'/);
    assert.doesNotMatch(source, /label: '번역 자막'/);
    assert.doesNotMatch(source, /label: '상황 설명'/);
    assert.match(source, /const \[activeCanvasCueFilterIds,\s*setActiveCanvasCueFilterIds\]/);
    assert.match(source, /const selectedCanvasMediaIdSet = useMemo/);
    assert.match(source, /const canvasCueFilterCounts = useMemo/);
    assert.match(source, /counts\[getCanvasCueFilterId\(row\)\] \+= 1;/);
    assert.match(source, /const toggleCanvasCueFilter = \(filterId: CanvasCueFilterId\)/);
    assert.match(source, /const selectAllCanvasCueFilters = \(\)/);
    assert.match(source, /className="tp-canvas-cue-filter"/);
    assert.match(source, /aria-label="캔버스 큐 필터"/);
    assert.match(source, /canvasCueFilterDefinitions\.map/);
    assert.match(source, /className="tp-canvas-cue-filter-box"/);
    assert.match(source, /<StudioCatalogIcon name="check" \/>/);
    assert.match(source, /canvasCueFilterCounts\[definition\.id\]/);
    assert.match(source, /전체 선택/);
    assert.match(source, /activeCanvasCueFilterIds\.includes\(\s*getCanvasCueFilterId\(row\)\s*\)/);
    assert.match(source, /function getCanvasCueFilterId/);
    assert.doesNotMatch(source, /normalizedTrackName\.includes\('번역'\)/);
    assert.doesNotMatch(source, /character\?\.role === 'narrator'/);
    assert.match(styles, /\.tp-canvas-cue-filter\s*\{/);
    assert.match(styles, /\.tp-canvas-cue-filter-chip\s*\{/);
    assert.match(styles, /\.tp-canvas-cue-filter-box\s*\{/);
    assert.match(styles, /\.tp-canvas-cue-filter-chip\.is-active \.tp-canvas-cue-filter-box/);
    assert.match(styles, /\.tp-canvas-cue-filter-all\s*\{/);
});

test('canvas cue cards show editable selected cue details in a separate panel', () => {
    const selectedCueFormStart = source.indexOf('className="tp-canvas-selected-cue tp-canvas-dialogue-form"');
    const selectedCueFormEnd = source.indexOf('className="tp-canvas-selected-cue-actions"', selectedCueFormStart);
    const selectedCueFormSnippet =
        selectedCueFormStart >= 0 && selectedCueFormEnd > selectedCueFormStart
            ? source.slice(selectedCueFormStart, selectedCueFormEnd)
            : '';

    assert.ok(selectedCueFormSnippet);
    assert.match(source, /const \[selectedCanvasCueId,\s*setSelectedCanvasCueId\] = useState<number \| null>\(null\);/);
    assert.match(source, /const selectedCanvasCueEntry = useMemo/);
    assert.match(source, /const selectedCanvasCueDefinition = selectedCanvasCueEntry/);
    assert.match(source, /const selectedCanvasCueSpeakerName = selectedCanvasCueEntry/);
    assert.match(source, /const \[selectedCanvasCueDraft,\s*setSelectedCanvasCueDraft\] = useState<CanvasCueInspectorDraft>/);
    assert.match(source, /const \[isSavingSelectedCanvasCue,\s*setIsSavingSelectedCanvasCue\] = useState\(false\);/);
    assert.match(source, /characterId: String\(selectedCanvasCueEntry\.cue\.characterId \?\? selectedCanvasCueEntry\.track\.characterId \?\? ''\)/);
    assert.match(source, /setSelectedCanvasCueDraft\(\{[\s\S]*?script: selectedCanvasCueEntry\.cue\.script/);
    assert.match(source, /durationSeconds: toDurationSecondsInput\(cueDuration\)/);
    assert.match(source, /const saveSelectedCanvasCue = async \(event: FormEvent<HTMLFormElement>\)/);
    assert.match(source, /const characterId = Number\(selectedCanvasCueDraft\.characterId\);/);
    assert.match(source, /selectedCanvasCueEntry\.mode === 'dialogue'[\s\S]*?대사의 캐릭터를 선택해 주세요/);
    assert.match(source, /selectedCanvasCueEntry\.mode === 'dialogue'[\s\S]*?ensureDialogueTrack/);
    assert.match(source, /await updateCue\(String\(selectedCanvasCueEntry\.track\.id\), String\(selectedCanvasCueEntry\.cue\.id\),/);
    assert.match(source, /targetTrackId: targetTrack\.id/);
    assert.match(source, /duration: selectedCanvasCueDraftDurationMs/);
    assert.match(source, /endTime: selectedCanvasCueEntry\.cue\.startTime \+ selectedCanvasCueDraftDurationMs/);
    assert.match(source, /const deleteSelectedCanvasCue = async \(\)/);
    assert.match(source, /await deleteCue\(String\(selectedCanvasCueEntry\.track\.id\), String\(selectedCanvasCueEntry\.cue\.id\)\)/);
    assert.match(source, /selectCanvasCue\(cue\.id\)/);
    assert.match(source, /role="button"/);
    assert.match(source, /tabIndex=\{0\}/);
    assert.match(source, /'tp-dialogue-strip-cue'/);
    assert.match(source, /selectedCanvasCueId === cue\.id[\s\S]*?\? 'is-selected'/);
    assert.match(source, /'tp-canvas-workbench has-cue-inspector'/);
    assert.match(source, /className="tp-canvas-col tp-canvas-col-cue-insp"/);
    assert.match(source, /<h2>선택 큐<\/h2>/);
    assert.match(source, /className="tp-canvas-cue-inspector"/);
    assert.match(source, /className="tp-canvas-selected-cue tp-canvas-dialogue-form"/);
    assert.match(source, /onSubmit=\{saveSelectedCanvasCue\}/);
    assert.match(source, /className="tp-canvas-selected-cue-head"/);
    assert.match(source, /selectedCanvasCueEntry\.mode === 'dialogue'/);
    assert.match(source, /aria-label="대사 수정 캐릭터"/);
    assert.match(selectedCueFormSnippet, /const characterId =\s*event\.currentTarget\.value;[\s\S]*?setSelectedCanvasCueDraft/);
    assert.match(selectedCueFormSnippet, /const script = event\.currentTarget\.value;[\s\S]*?setSelectedCanvasCueDraft/);
    assert.match(selectedCueFormSnippet, /const canvasMediaId =\s*event\.currentTarget\.value;[\s\S]*?setSelectedCanvasCueDraft/);
    assert.match(selectedCueFormSnippet, /const position =\s*event\.currentTarget\.value;[\s\S]*?setSelectedCanvasCueDraft/);
    assert.match(selectedCueFormSnippet, /const durationSeconds =\s*event\.currentTarget\.value;[\s\S]*?setSelectedCanvasCueDraft/);
    assert.doesNotMatch(
        selectedCueFormSnippet,
        /setSelectedCanvasCueDraft\(\(current\) => \(\{(?:(?!\}\)\);)[\s\S])*event\.currentTarget\.value/
    );
    assert.match(source, /className="tp-canvas-cue-meta"/);
    assert.match(source, /aria-label=\{`\$\{selectedCanvasCueDefinition\.label\} 수정 컷`\}/);
    assert.match(source, /aria-label=\{`\$\{selectedCanvasCueDefinition\.label\} 수정 위치값`\}/);
    assert.match(source, /aria-label=\{`\$\{selectedCanvasCueDefinition\.label\} 수정 길이`\}/);
    assert.match(source, /className="tp-canvas-selected-cue-actions"/);
    assert.match(source, /onClick=\{\(\) => void deleteSelectedCanvasCue\(\)\}/);
    assert.match(source, /<StudioCatalogIcon name="trash" \/>/);
    assert.match(source, /삭제/);
    assert.match(source, /수정 저장/);
    assert.match(source, /selectedCanvasCueEntry\.track\.name/);
    assert.doesNotMatch(source, /className="tp-canvas-dialogue-form tp-canvas-selected-cue-form"/);
    assert.doesNotMatch(source, /tp-canvas-resource-hitarea/);
    assert.doesNotMatch(source, /tp-canvas-selected-resource/);
    assert.match(styles, /\.tp-canvas-workbench\.has-cue-inspector/);
    assert.match(styles, /\.tp-canvas-col-cue-insp/);
    assert.match(styles, /\.tp-canvas-cue-inspector/);
    assert.match(styles, /\.tp-canvas-dialogue-line \.tp-dialogue-strip-cue\.is-selected/);
    assert.match(styles, /\.tp-canvas-selected-cue/);
    assert.match(styles, /\.tp-canvas-selected-cue-grid/);
    assert.match(styles, /\.tp-canvas-selected-cue-actions/);
    assert.match(styles, /\.tp-canvas-cue-meta/);
    assert.doesNotMatch(styles, /\.tp-canvas-selected-cue-form/);
    assert.doesNotMatch(styles, /\.tp-canvas-resource-hitarea/);
    assert.doesNotMatch(styles, /\.tp-canvas-selected-resource/);
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
