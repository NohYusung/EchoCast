import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioRecordDashboard.tsx', import.meta.url), 'utf8');
const recordingStudioSource = readFileSync(new URL('../../player/recordingStudio.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('recording strip exposes a ratio-preserving size control', () => {
    assert.match(source, /toRecordingStripSize/);
    assert.match(source, /aria-label="녹음 스트립 크기"/);
    assert.match(source, /aria-label="녹음 스트립 크기 숫자"/);
    assert.match(source, /'--tr-record-strip-panel-width': `\$\{recordingStripSize\.panelWidth\}px`/);
    assert.match(source, /폭 \{recordingStripSize\.width\}px · 패널 \{recordingStripSize\.panelWidth\}px · 원본 비율/);
    assert.match(recordingStudioSource, /panelWidth: Math\.round\(defaultRecordingStripWidth \* ratio\) \+ 64/);
    assert.doesNotMatch(recordingStudioSource, /panelWidth: Math\.max\(384/);
    assert.match(styles, /--tr-record-strip-width/);
    assert.match(styles, /grid-template-columns: 306px var\(--tr-record-strip-panel-width, 384px\)/);
});

test('recording strip renders cue markers inside their saved canvas media clip', () => {
    assert.match(source, /stripCueMarkersByCanvasMediaId/);
    assert.match(source, /clipMarkers\.map\(\(marker\)/);
    assert.match(source, /top: `\$\{marker\.positionPercent\}%`/);
    assert.match(styles, /\.tr-strip-clip > img,[\s\S]*?\.tr-strip-clip > video/);
});

test('recording strip does not cap canvas media count', () => {
    assert.doesNotMatch(source, /\.slice\(0,\s*10\)/);
});

test('recording character filters stay normalized and wrap inside the queue panel', () => {
    assert.match(source, /normalizeSelectedCharacterIds/);
    assert.match(source, /selectedAvailableCharacterIds\.length\} \/ \{availableCharacters\.length\} 캐릭터 선택/);
    assert.match(source, /selectedAvailableCharacterIdSet/);
    assert.match(styles, /\.tr-character-filter\s*\{[\s\S]*?flex-wrap: wrap;/);
    assert.match(styles, /\.tr-character-filter\s*\{[\s\S]*?overflow: visible;/);
});

test('recording status filters keep compact rows above the cue list', () => {
    assert.match(styles, /\.tr-queue-panel\s*\{[\s\S]*?grid-template-rows: auto auto auto minmax\(0, 1fr\);/);
    assert.match(styles, /\.tr-filter-tabs\s*\{[\s\S]*?align-self: start;/);
    assert.match(styles, /\.tr-filter-tabs\s*\{[\s\S]*?display: inline-flex;/);
    assert.match(styles, /\.tr-filter-tabs\s*\{[\s\S]*?background: #161922;/);
    assert.match(styles, /\.tr-filter-tabs button\s*\{[\s\S]*?min-height: 29px;/);
    assert.match(styles, /\.tr-filter-tabs button\.active\s*\{[\s\S]*?background: #232734;/);
});

test('recording cue rows do not show timeline start time', () => {
    assert.match(source, /장면 \{item\.sortOrder\} · 테이크 \{item\.takeCount\}/);
    assert.doesNotMatch(source, /formatMs\(item\.startTime\)/);
});

test('recording take list fills the take panel without summary stats', () => {
    assert.match(styles, /\.tr-take-panel\s*\{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);/);
    assert.match(styles, /\.tr-take-list\s*\{[\s\S]*?overflow: auto;/);
    assert.doesNotMatch(source, /완료 대사/);
    assert.doesNotMatch(source, /총 녹음 길이/);
    assert.doesNotMatch(styles, /\.tr-record-stats/);
    assert.doesNotMatch(styles, /\.tr-take-panel\s*\{[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) auto auto;/);
});

test('recording screen does not show the unimplemented export action', () => {
    assert.doesNotMatch(source, /완료본 편집기로 전달/);
    assert.doesNotMatch(source, /tr-export/);
    assert.doesNotMatch(styles, /\.tr-export/);
});

test('recording console exposes playback, stop, and record controls', () => {
    assert.match(source, /aria-label=\{isFocusedRecordPlaying \? '일시정지' : '재생'\}/);
    assert.match(source, /aria-label="정지"/);
    assert.match(source, /aria-label="녹음"/);
    assert.match(source, /onClick=\{stopTransport\}/);
    assert.match(source, /onClick=\{\(\) => void startRecording\(\)\}/);
    assert.doesNotMatch(source, /toggleRecording/);
    assert.doesNotMatch(styles, /\.tr-record-main/);
});

test('recording console can import an external audio file as a record', () => {
    assert.match(source, /import \{ getAudioDuration \} from '\.\.\/player\/audioDuration';/);
    assert.match(source, /const EXTERNAL_RECORD_ACCEPT = 'audio\/\*,\.mp3,\.m4a,\.wav,\.ogg,\.webm';/);
    assert.match(source, /const externalRecordInputRef = useRef<HTMLInputElement \| null>\(null\);/);
    assert.match(source, /async function importExternalRecordFile\(file: File\)/);
    assert.match(source, /const durationMs = await getAudioDuration\(file\);/);
    assert.match(source, /recordFile: file/);
    assert.match(source, /contentType: getExternalRecordContentType\(file\)/);
    assert.match(source, /aria-label="외부 녹음 파일 가져오기"/);
    assert.match(source, /<span>파일 가져오기<\/span>/);
    assert.match(source, /accept=\{EXTERNAL_RECORD_ACCEPT\}/);
    assert.match(source, /onChange=\{handleExternalRecordFileChange\}/);
    assert.match(source, /setMessage\('외부 녹음 파일을 등록했습니다\.'\)/);
    assert.match(styles, /\.tr-external-record-input\s*\{[\s\S]*?display: none;/);
});

test('recording can start and save without a selected artist', () => {
    assert.doesNotMatch(source, /녹음할 성우를 먼저 선택하세요/);
    assert.doesNotMatch(source, /if \(!cue \|\| !artistId \|\| chunks\.length === 0\) return;/);
    assert.match(source, /if \(!cue \|\| chunks\.length === 0\) return;/);
    assert.match(source, /recordingArtistIdRef\.current = selectedArtistId \|\| undefined;/);
    assert.match(source, /disabled=\{!selectedCue \|\| isSavingRecord \|\| isRecording\}/);
    assert.doesNotMatch(source, /disabled=\{!selectedCue \|\| !selectedArtistId \|\| isSavingRecord \|\| isRecording\}/);
});

test('recording screen focuses the latest saved take until the user clicks another take', () => {
    assert.match(source, /const \[focusedRecordKey, setFocusedRecordKey\]/);
    assert.match(source, /const nextRecord = getLatestRecordingTake\(nextCue\?\.records \?\? \[\]\)/);
    assert.match(source, /setFocusedRecordKey\(getRecordingTakeKey\(nextRecord\)\)/);
    assert.match(source, /onClick=\{\(\) => \{[\s\S]*?stopRecordPlayback\(\);[\s\S]*?setFocusedRecordKey\(recordKey\);[\s\S]*?\}\}/);
    assert.match(source, /tr-take-card \$\{record\.isAccepted \? 'accepted' : ''\} \$\{recordKey === activeFocusedRecordKey \? 'is-focused' : ''\}/);
    assert.match(styles, /\.tr-take-card\.is-focused\s*\{/);
});

test('recording read panel shows the selected cue media above the dialogue text', () => {
    assert.match(source, /const selectedCueClip = useMemo/);
    assert.match(source, /<div className="tr-cue-stage">/);
    assert.match(source, /<div className="tr-cue-preview" style=\{selectedCueClip \? getStripClipStyle\(selectedCueClip\) : undefined\}>/);
    assert.match(source, /<RecordStagePreview clip=\{selectedCueClip\} \/>/);
    assert.match(source, /<div className="tr-cue-caption">/);
    assert.match(source, /<p>\{selectedCue\.trackName\}<\/p>/);
    assert.doesNotMatch(source, /selectedCue\.trackName\} · \{formatMs\(selectedCue\.startTime\)\}/);
    assert.match(styles, /\.tr-cue-stage\s*\{[\s\S]*?grid-template-rows: minmax\(0, 1fr\) auto;/);
    assert.match(styles, /\.tr-cue-preview\s*\{[\s\S]*?min-height: 260px;/);
    assert.match(styles, /\.tr-cue-caption\s*\{[\s\S]*?border-top: 1px solid var\(--tr-line\);/);
});

test('recording waveform decodes focused take audio and caches rendered peaks', () => {
    assert.match(source, /const RECORD_WAVEFORM_BAR_COUNT = 300;/);
    assert.match(source, /const \[recordWaveforms, setRecordWaveforms\]/);
    assert.match(source, /const activeRecordWaveform = activeFocusedRecordKey \? recordWaveforms\[activeFocusedRecordKey\] : undefined;/);
    assert.match(source, /buildRecordWaveformPeaks\(focusedRecord\.audioUrl, RECORD_WAVEFORM_BAR_COUNT\)/);
    assert.match(source, /if \(!focusedRecord\?\.audioUrl \|\| !activeFocusedRecordKey \|\| activeRecordWaveform\) return;/);
    assert.match(source, /audioContext\.decodeAudioData\(await response\.arrayBuffer\(\)\)/);
    assert.match(source, /setRecordWaveforms\(\(current\) =>/);
    assert.match(source, /const hasRecordWaveform = isRecording \|\| Boolean\(focusedRecord\?\.audioUrl\);/);
    assert.match(source, /focusedRecord\?\.audioUrl\s*\?\s*activeRecordWaveform \?\? createWave\(focusedRecord\.audioUrl, RECORD_WAVEFORM_BAR_COUNT\)\s*:\s*\[\]/);
    assert.match(source, /function createWave\(seed: string \| number \| undefined, count: number\): number\[\]/);
    assert.doesNotMatch(source, /createWave\(focusedRecord\?\.audioUrl \?\? selectedCue\?\.cueId \?\? 'empty', RECORD_WAVEFORM_BAR_COUNT\)/);
    assert.match(source, /\{hasRecordWaveform \? \(/);
    assert.match(source, /<div className="tr-waveform-empty">녹음 파일 없음<\/div>/);
    assert.match(styles, /\.tr-waveform-empty\s*\{/);
    assert.match(source, /'--tr-waveform-bar-count': currentWave\.length/);
    assert.match(styles, /\.tr-waveform-bars\s*\{/);
    assert.match(styles, /grid-template-columns: repeat\(var\(--tr-waveform-bar-count\), minmax\(0, 1fr\)\);/);
    assert.match(styles, /\.tr-waveform-bars i\s*\{/);
    assert.match(styles, /align-items: end;/);
    assert.match(styles, /gap: 1px;/);
    assert.match(styles, /width: min\(2px, 100%\);/);
    assert.match(styles, /align-self: end;/);
    assert.match(styles, /background: rgba\(255, 255, 255, 0\.16\);/);
    assert.match(styles, /background: #ed1c24;/);
});

test('recording waveform progress fill follows actual audio playback progress', () => {
    assert.match(source, /const \[recordPlaybackProgress, setRecordPlaybackProgress\]/);
    assert.match(source, /const waveformRef = useRef<HTMLDivElement \| null>\(null\);/);
    assert.match(source, /const recordPlaybackProgressRef = useRef\(0\);/);
    assert.match(source, /const recordPlaybackFrameRef = useRef<number \| undefined>\(undefined\);/);
    assert.match(source, /startRecordPlaybackProgressLoop\(currentAudio, record\)/);
    assert.match(source, /startRecordPlaybackProgressLoop\(audio, record\)/);
    assert.match(source, /function startRecordPlaybackProgressLoop\(audio: HTMLAudioElement, record: RecordingTakeSummary \| undefined\)/);
    assert.match(source, /audio\.ontimeupdate = \(\) => updateRecordPlaybackProgressForRecord\(audio, record\);/);
    assert.match(source, /audio\.onloadedmetadata = \(\) => updateRecordPlaybackProgressForRecord\(audio, record\);/);
    assert.match(source, /window\.requestAnimationFrame\(tick\)/);
    assert.match(source, /updateRecordPlaybackProgressForRecord\(audio, record\)/);
    assert.doesNotMatch(source, /function updateRecordPlaybackProgress\(audio: HTMLAudioElement\)/);
    assert.match(source, /function syncRecordPlaybackProgress\(progress: number, options\?: \{ syncState\?: boolean \}\)/);
    assert.match(source, /waveformRef\.current\?\.style\.setProperty\('--tr-waveform-progress', `\$\{progressPercent\}%`\);/);
    assert.match(source, /now - recordPlaybackProgressStateSyncedAtRef\.current > 250/);
    assert.match(source, /const waveformProgressPercent = isRecording \? 0 : Math\.round\(Math\.min\(1, Math\.max\(0, recordPlaybackProgress\)\) \* 10000\) \/ 100;/);
    assert.match(source, /'--tr-waveform-progress': `\$\{waveformProgressPercent\}%`/);
    assert.match(source, /className="tr-waveform-progress"/);
    assert.match(source, /ref=\{waveformRef\}/);
    assert.match(styles, /\.tr-waveform-progress\s*\{/);
    assert.match(styles, /clip-path: inset\(0 calc\(100% - var\(--tr-waveform-progress\)\) 0 0\);/);
    assert.doesNotMatch(styles, /transition: clip-path 120ms linear;/);
});

test('recording durations are displayed as readable seconds', () => {
    assert.match(source, /function formatDurationSeconds\(milliseconds: number\): string/);
    assert.match(source, /return `\$\{formattedSeconds\}초`;/);
    assert.match(source, /<span className="tr-waveform-time">\{formatDurationSeconds\(waveformDurationMs\)\}<\/span>/);
    assert.match(source, /서버 기록 · \{formatDurationSeconds\(record\.durationMs \?\? 0\)\}/);
});

test('recording waveform can seek playback by clicking a timeline position', () => {
    assert.match(source, /const recordPlaybackSeekRef = useRef<\{ recordKey: string; seconds: number \} \| undefined>\(undefined\);/);
    assert.match(source, /function seekRecordWaveform\(event: ReactPointerEvent<HTMLDivElement>\)/);
    assert.match(source, /const ratio = Math\.min\(1, Math\.max\(0, \(event\.clientX - rect\.left\) \/ rect\.width\)\);/);
    assert.match(source, /recordPlaybackSeekRef\.current = \{ recordKey: activeFocusedRecordKey, seconds: nextSeconds \};/);
    assert.match(source, /currentAudio\.currentTime = nextSeconds;/);
    assert.match(source, /applyPendingRecordPlaybackSeek\(audio, recordKey, record\)/);
    assert.match(source, /recordPlaybackSeekRef\.current = undefined;/);
    assert.match(source, /onPointerDown=\{seekRecordWaveform\}/);
    assert.match(source, /role="slider"/);
    assert.match(styles, /\.tr-waveform\s*\{[\s\S]*?cursor: pointer;/);
    assert.match(styles, /\.tr-waveform\s*\{[\s\S]*?touch-action: none;/);
});
