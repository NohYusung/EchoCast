/*
AGENT
- 성우 녹음 전 cue에 채워 넣을 TTS 음성 메타 정보를 관리하는 엔티티다.
- CueEntity.ttsVoiceId와 CharacterEntity.defaultTtsVoiceId가 참조한다.
- player manifest에서는 cue.ttsVoiceId와 cue.ttsUrl이 모두 있을 때 TTS 항목을 생성한다.
- test-player rules 기준으로 domain/<domain>.entity.ts는 도메인당 하나만 둔다.
- 기초 칼럼 구성은 id, provider, voiceName, voiceKey, languageCode, fileUrl, metadata 이다.
- id: varchar primary key. 현재 player draft 계약은 string id를 사용한다.
- provider: TTS 제공자 또는 내부 fixture provider 값.
- voiceName: 사용자와 manifest에 노출되는 음성 이름.
- voiceKey: provider 안에서 TTS API 호출에 쓰는 실제 음성 키. 현재 저장 로직은 voiceName을 기본값으로 사용한다.
- languageCode: ko-KR 같은 음성 언어 코드.
- fileUrl: 음성 preview/default sample URL. cue별 생성 음원은 CueEntity.ttsUrl에 둔다.
- metadata: provider별 pitch, rate, style 같은 확장 설정을 simple-json으로 보관한다.
*/
