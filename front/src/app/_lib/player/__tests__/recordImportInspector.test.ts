import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../StudioEditor.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('voice cue inspector lists only accepted records for the selected cue', () => {
    assert.match(source, /type RecordListItem = \{/);
    assert.match(source, /async function listRecords\(apiBaseUrl: string\)/);
    assert.match(source, /selectedAudioTrack\?\.kind === 'record'/);
    assert.match(
        source,
        /recordItems\.filter\(\(record\) => String\(record\.cueId\) === selectedCueApiId && record\.isAccepted\)/
    );
    assert.match(source, /const playbackTimelineClips = timelineData\.timelineClips;/);
    assert.match(source, /clips: playbackTimelineClips/);
    assert.doesNotMatch(source, /applyAcceptedRecordsToTimelineClips/);
    assert.match(source, /이 큐에 연결된 채택 녹음이 없습니다\./);
    assert.match(styles, /\.odx-record-import-panel\s*\{/);
});

test('voice cue inspector shows accepted records without import actions', () => {
    assert.match(source, /record \{record\.id\} · \{durationLabel\}/);
    assert.doesNotMatch(source, /const handleImportAcceptedRecord = async/);
    assert.doesNotMatch(source, /onImportAcceptedRecord/);
    assert.doesNotMatch(source, />가져오기</);
    assert.doesNotMatch(source, /가져오는 중/);
});
