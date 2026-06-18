import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('voice cue inspector lists only accepted records for the selected cue', () => {
    assert.match(source, /type RecordListItem = \{/);
    assert.match(source, /async function listRecords\(apiBaseUrl: string\)/);
    assert.match(source, /selectedAudioTrack\?\.kind === 'record'/);
    assert.match(source, /recordItems\.filter\(\(record\) => String\(record\.cueId\) === selectedCueApiId && record\.isAccepted\)/);
    assert.match(source, /이 큐에 연결된 채택 녹음이 없습니다\./);
    assert.match(styles, /\.odx-record-import-panel\s*\{/);
});

test('record import updates cue timing from the accepted record duration', () => {
    assert.match(source, /const handleImportAcceptedRecord = async \(cueClipId: string, recordId: number\) => \{/);
    assert.match(source, /!record \|\| !record\.isAccepted \|\| String\(record\.cueId\) !== cueId/);
    assert.match(source, /const endTime = startTime \+ record\.duration;/);
    assert.match(source, /await updateCue\(resolvedApiBaseUrl, cueTrackId, cueId, \{\s*startTime,\s*endTime,/);
    assert.match(source, /audioUrl: record\.recordUrl/);
    assert.match(source, /onImportAcceptedRecord\(item\.id, record\.id\)/);
});
