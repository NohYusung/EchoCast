/*
AGENT
- 특정 에피소드 안에서 player timeline을 구성하는 재생 구간과 레이어 배치 도메인이다.
- mediaId/cueId/startTime/endTime/type은 실제 재생 구간을 설명하므로 TrackDraft의 레이어 정보와 TimelineItemDraft의 배치 정보를 함께 본다.
- test-player rules 기준으로 domain/<domain>.entity.ts는 도메인당 하나만 둔다.
- 기초 칼럼 구성은 id, episodeId, mediaId, cueId, startTime, endTime, type, layerId 이다.
- id: autoIncrement_pk 또는 varchar primary key. 현재 player draft 계약은 string id를 사용한다.
- episodeId: 특정 에피소드의 id.
- mediaId: 에피소드에서 사용하는 미디어 리소스 id_fk_nullable. cue 타입이면 null 가능하다.
- cueId: 에피소드에서 사용하는 cue id_fk_nullable. media 타입이면 null 가능하다.
- startTime: 에피소드 타임라인에서 재생 구간이 시작되는 시간 값(ms).
- endTime: 에피소드 타임라인에서 재생 구간이 종료되는 시간 값(ms). startTime보다 커야 한다.
- type: 타임라인 구간 타입. visual, audio, effect, cue 중 하나를 사용한다.
- layerId: 같은 타임라인에서 미디어 혹은 cue가 올라가는 레이어 번호.
- mediaId와 cueId는 type에 따라 하나만 참조한다. duration은 endTime - startTime으로 계산한다.
*/
