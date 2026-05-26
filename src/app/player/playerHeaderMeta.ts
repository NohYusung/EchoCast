export interface PlayerMeta {
  title: string;
  subtitle: string;
  /** 서버 holes API용 episodeId (URL에 ?episodeId= 가 없을 때 폴백) */
  episodeId?: number;
}

export const PLAYER_HEADER_META: Record<string, PlayerMeta> = {
  "three-kingdoms-ep0": { title: "미리보기", subtitle: "세상의 시작" },
  "three-kingdoms-ep1": { title: "1화", subtitle: "체험하기 : 세상의 시작", episodeId: 344 },
  "three-kingdoms-ep2": { title: "2화", subtitle: "체험하기 : 타탄 신족의 탄생!" },
};
