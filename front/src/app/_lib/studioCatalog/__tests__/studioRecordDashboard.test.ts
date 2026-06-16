import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioRecordDashboard.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('recording strip exposes a ratio-preserving size control', () => {
    assert.match(source, /toRecordingStripSize/);
    assert.match(source, /aria-label="녹음 스트립 크기"/);
    assert.match(source, /aria-label="녹음 스트립 크기 숫자"/);
    assert.match(source, /'--tr-record-strip-panel-width': `\$\{recordingStripSize\.panelWidth\}px`/);
    assert.match(source, /폭 \{recordingStripSize\.width\}px · 패널 \{recordingStripSize\.panelWidth\}px · 원본 비율/);
    assert.match(styles, /--tr-record-strip-width/);
    assert.match(styles, /grid-template-columns: 306px var\(--tr-record-strip-panel-width, 384px\)/);
});

test('recording strip renders cue markers inside their saved canvas media clip', () => {
    assert.match(source, /stripCueMarkersByCanvasMediaId/);
    assert.match(source, /clipMarkers\.map\(\(marker\)/);
    assert.match(source, /top: `\$\{marker\.positionPercent\}%`/);
    assert.match(styles, /\.tr-strip-clip > img,[\s\S]*?\.tr-strip-clip > video/);
});

test('recording character filters stay normalized and wrap inside the queue panel', () => {
    assert.match(source, /normalizeSelectedCharacterIds/);
    assert.match(source, /selectedAvailableCharacterIds\.length\} \/ \{availableCharacters\.length\} 캐릭터 선택/);
    assert.match(source, /selectedAvailableCharacterIdSet/);
    assert.match(styles, /\.tr-character-filter\s*\{[\s\S]*?flex-wrap: wrap;/);
    assert.match(styles, /\.tr-character-filter\s*\{[\s\S]*?overflow: visible;/);
});
