import type { PlayerDraft } from "../domain/player-contract.types";

export function createPlayerDraftFixture(): PlayerDraft {
  return {
    products: [
      {
        id: "product-100",
        title: "테스트 작품",
        coverImageUrl: "/covers/test-player.png",
      },
    ],
    episodes: [
      {
        id: "sample-player",
        productId: "product-100",
        episodeNumber: 1,
        title: "1화",
      },
    ],
    characters: [
      {
        id: "character-hero",
        name: "주인공",
        color: "#2563eb",
        defaultTtsVoiceId: "voice-hero",
      },
      {
        id: "character-guide",
        name: "해설",
        color: "#16a34a",
      },
    ],
    scripts: [
      {
        id: "script-5001",
        episodeId: "sample-player",
        characterId: "character-hero",
        text: "첫 번째 컷을 열어.",
        sortOrder: 1,
      },
      {
        id: "script-5002",
        episodeId: "sample-player",
        characterId: "character-guide",
        text: "이미지가 천천히 내려간다.",
        sortOrder: 2,
      },
    ],
    tracks: [
      {
        id: "track-visual",
        episodeId: "sample-player",
        name: "Visual",
        kind: "visual",
        layerId: 0,
        isMuted: false,
      },
      {
        id: "track-dialogue",
        episodeId: "sample-player",
        name: "Dialogue",
        kind: "dialogue",
        layerId: 1,
        isMuted: false,
      },
    ],
    timelineItems: [
      {
        id: "visual-strip-1",
        trackId: "track-visual",
        kind: "visual",
        startTime: 0,
        endTime: 12000,
        mediaId: "media-strip-1",
        layerId: 0,
      },
      {
        id: "cue-item-5001",
        trackId: "track-dialogue",
        kind: "cue",
        startTime: 0,
        endTime: 2200,
        cueId: "cue-5001",
        layerId: 1,
      },
      {
        id: "cue-item-5002",
        trackId: "track-dialogue",
        kind: "cue",
        startTime: 2600,
        endTime: 6200,
        cueId: "cue-5002",
        layerId: 1,
      },
    ],
    media: [
      {
        id: "media-strip-1",
        episodeId: "sample-player",
        kind: "image",
        url: "/media/strip-1.webp",
        naturalWidth: 690,
        naturalHeight: 4200,
      },
    ],
    ttsVoices: [
      {
        id: "voice-hero",
        provider: "test-player",
        voiceName: "hero-ko",
        languageCode: "ko-KR",
      },
    ],
    cues: [
      {
        id: "cue-5001",
        episodeId: "sample-player",
        scriptId: "script-5001",
        characterId: "character-hero",
        trackId: "track-dialogue",
        startTime: 0,
        endTime: 2200,
        ttsVoiceId: "voice-hero",
        ttsUrl: "/audio/tts-5001.wav",
        volume: 1,
      },
      {
        id: "cue-5002",
        episodeId: "sample-player",
        scriptId: "script-5002",
        characterId: "character-guide",
        trackId: "track-dialogue",
        startTime: 2600,
        endTime: 6200,
        volume: 0.92,
      },
    ],
    records: [
      {
        id: "record-5001-approved",
        cueId: "cue-5001",
        artistId: "artist-1",
        status: "approved",
        audioUrl: "/audio/record-5001-approved.wav",
        durationMs: 2100,
        volume: 1,
      },
    ],
  };
}
