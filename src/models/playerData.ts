export interface PurchaseCasting {
  id: number;
  seriesId: number;
  episodeId: number;
  characterId: number;
  artistId: number;
  sampleScriptUrl: string | null;
  character: PurchaseCharacter | null;
  artist: PurchaseArtist | null;
  coupleArtists: PurchaseArtist[] | null;
  isFollowed?: boolean;
  artist_no: number;
}

export interface PurchaseUser {
  coin: number;
  bonusCoin: number;
}

export interface PurchaseEpisode {
  id: number;
  seriesId: number;
  thumbnailImageUrl: string | null;
  version: string | null;
  seriesName: string;
  episodeTitle: string;
  episodeSubtitle: string | null;
  chapter: number;
  isFinalChapter: boolean;
  expectedPublishOn: string | null;
  contentPricePolicyIds: string | null;
  initialCoin: number | null;
  additionalCoin: number | null;
  hasTicket: boolean;
  isFree: boolean;
}

export interface PurchaseCharacter {
  id: number;
  seriesId: number;
  profileImageUrl: string | null;
  name: string;
  description: string | null;
  castingType: string;
  sampleScript: string | null;
  isOpen: boolean;
  castings: PurchaseCasting[];
  isCoupling: boolean;
  splitCharacterIds: number[];
  dubrightUUID: string | null;
}

export interface PurchaseArtist {
  id: number;
  nickname: string;
  profileImageUrl: string | null;
  introduction: string | null;
  name: string;
  dubrightId: number | null;
  isCoupling: boolean;
  splitArtistIds: number[];
}

export interface PurchaseTicket {
  id: string;
  seriesId: number;
  episodeId: number;
  castingIds: number[];
  name: string | null;
  createdAt: string;
  index: number | null;
}

export interface PurchaseDirection {
  archive_id: number;
  episode_no: number;
  no: number;
  version: string;
  product_no: number;
  images: string | null;
  spoints: string | null;
  effects: string | null;
}

export interface PurchaseData {
  user: PurchaseUser | null;
  episode: PurchaseEpisode | null;
  tickets: PurchaseTicket[];
  castings: PurchaseCasting[];
  characters: PurchaseCharacter[];
  directions: PurchaseDirection[];
  episodes: PurchaseEpisode[];
  content: unknown;
  castingTicket: PurchaseTicket | null;
  coupleArtists: PurchaseArtist[] | null;
  clearTextImages: unknown[] | null;
}

export const PLAYER_DEFAULT_EFFECT = {
  chorus: { frequency: 0, delayTime: 0, depth: 0 },
  reverb: { decay: 0, preDelay: 0 },
  delay: { delay: 0, feedback: 0 },
  eq: { gain_values: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  gain: { value: 1 },
  pitch_shift: 0,
};
