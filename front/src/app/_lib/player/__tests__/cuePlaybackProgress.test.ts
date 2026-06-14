import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCuePlaybackClock, getActiveCuePlaybackProgressLabel, getCuePlaybackProgressLabel } from '../cuePlaybackProgress';

test('formatCuePlaybackClock renders whole-second playback time with Korean seconds suffix', () => {
    assert.equal(formatCuePlaybackClock(3.9), '00:00:03초');
    assert.equal(formatCuePlaybackClock(302), '00:05:02초');
    assert.equal(formatCuePlaybackClock(3723), '01:02:03초');
});

test('getCuePlaybackProgressLabel renders elapsed cue time against cue duration while playhead is inside the cue', () => {
    assert.equal(
        getCuePlaybackProgressLabel(
            {
                start: 10,
                duration: 302,
            },
            13.4,
        ),
        '00:00:03초 / 00:05:02초',
    );
});

test('getCuePlaybackProgressLabel hides progress when playhead is outside the cue range', () => {
    const clip = {
        start: 10,
        duration: 5,
    };

    assert.equal(getCuePlaybackProgressLabel(clip, 9.99), null);
    assert.equal(getCuePlaybackProgressLabel(clip, 15), null);
});

test('getActiveCuePlaybackProgressLabel prefers the selected active cue then falls back to the first active cue', () => {
    const clips = [
        { id: 'cue-a', start: 10, duration: 10 },
        { id: 'cue-b', start: 12, duration: 20 },
    ];

    assert.equal(getActiveCuePlaybackProgressLabel(clips, 15, 'cue-b'), '00:00:03초 / 00:00:20초');
    assert.equal(getActiveCuePlaybackProgressLabel(clips, 15, 'missing'), '00:00:05초 / 00:00:10초');
    assert.equal(getActiveCuePlaybackProgressLabel(clips, 35, 'cue-b'), null);
});
