import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioRecordDashboard.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('recording strip exposes a ratio-preserving size control', () => {
    assert.match(source, /toRecordingStripSize/);
    assert.match(source, /aria-label="녹음 스트립 크기"/);
    assert.match(source, /aria-label="녹음 스트립 크기 숫자"/);
    assert.match(source, /폭 \{recordingStripSize\.width\}px · 원본 비율/);
    assert.match(styles, /--tr-record-strip-width/);
});

test('recording strip renders cue markers inside their saved canvas media clip', () => {
    assert.match(source, /stripCueMarkersByCanvasMediaId/);
    assert.match(source, /clipMarkers\.map\(\(marker\)/);
    assert.match(source, /top: `\$\{marker\.positionPercent\}%`/);
    assert.match(styles, /\.tr-strip-clip > img,[\s\S]*?\.tr-strip-clip > video/);
});
