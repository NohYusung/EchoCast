/**
 * 환경 감지 유틸리티 (플레이어 API용)
 */

/** 이미지/음원 등 미디어 base URL. 기본값 S3, NEXT_PUBLIC_MEDIA_BASE_URL 으로 덮을 수 있음 */
const DEFAULT_MEDIA_BASE = "https://dubright-contents.s3.ap-northeast-2.amazonaws.com/dubright";
const MEDIA_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MEDIA_BASE_URL) || DEFAULT_MEDIA_BASE;

/** 미디어 타입별 Request URL 접두사 (base 다음 경로). S3 실제 경로와 일치 (images, records, tts, audio) */
export const MEDIA_PREFIX = {
  image: "images",
  records: "records",
  tts: "tts",
  audio: "audio",
} as const;

export type MediaUrlType = keyof typeof MEDIA_PREFIX;

/**
 * JSON에 있는 상대 경로를 실제 요청 URL로 변환.
 * type 지정 시: base + 접두사 + path (예: base/records/2025-10/xxx.webm)
 * type 미지정 시: base + path (기존 동작)
 */
export function getMediaUrl(
  path: string | undefined | null,
  type?: MediaUrlType
): string {
  if (path == null || typeof path !== "string") return "";
  const s = path.trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = MEDIA_BASE.replace(/\/$/, "");
  const p = s.startsWith("/") ? s.slice(1) : s;
  // 음성 파일은 항상 records 접두사 사용 (S3 경로 규칙)
  const isWebm = /\.webm$/i.test(p) || /\.mpeg$/i.test(p) ||  /\.x-m4a$/i.test(p);
  const effectiveType = isWebm ? "records" : type;
  const prefix = effectiveType ? MEDIA_PREFIX[effectiveType] : "";
  const pathPart = prefix ? `${prefix}/${p}` : p;
  return base ? `${base}/${pathPart}` : `/${pathPart}`;
}

/** lib 전용 미디어 base. webtoon/... 경로일 때만 사용. 기존 MEDIA_BASE/requestUrl에는 영향 없음 */
const DEFAULT_LIB_MEDIA_BASE = "https://dobedub-contents.s3.ap-northeast-2.amazonaws.com";
export const LIB_MEDIA_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_LIB_MEDIA_BASE_URL) || DEFAULT_LIB_MEDIA_BASE;

/**
 * lib 전용: 상대 경로만 base에 붙여 request URL 생성.
 * dobedub-contents 버킷 기준 (예: .../webtoon/219/round/3342/images/xxx.jpg)
 */
export function getLibMediaUrl(path: string | undefined | null): string {
  if (path == null || typeof path !== "string") return "";
  const s = path.trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = LIB_MEDIA_BASE.replace(/\/$/, "");
  const p = s.startsWith("/") ? s.slice(1) : s;
  return base ? `${base}/${p}` : `/${p}`;
}

/** lib 콘텐츠 경로 여부 (webtoon/ 로 시작하면 getLibMediaUrl 사용) */
export function isLibMediaPath(path: string | undefined | null): boolean {
  return typeof path === "string" && path.trim().startsWith("webtoon/");
}

const S3_ORIGIN = "https://dubright-contents.s3.ap-northeast-2.amazonaws.com";

/** NEXT_PUBLIC_USE_MEDIA_PROXY === "true" 일 때만 프록시 사용. false 또는 미설정 시 S3 직접 요청 (CORS 설정 필요) */
const USE_MEDIA_PROXY =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_USE_MEDIA_PROXY) === "true";

/**
 * 브라우저에서 fetch할 URL.
 * USE_MEDIA_PROXY면 S3 URL을 프록시 경로로 변환, 아니면 URL 그대로 반환.
 */
export function getFetchUrl(mediaUrl: string): string {
  if (!mediaUrl) return "";
  if (USE_MEDIA_PROXY && mediaUrl.startsWith(S3_ORIGIN)) {
    return `/api/media-proxy?url=${encodeURIComponent(mediaUrl)}`;
  }
  return mediaUrl;
}

export type Environment = "local" | "development" | "staging" | "production";

export function getEnvironment(): Environment {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1")) return "local";
  if (apiBaseUrl.includes("dev")) return "development";
  if (apiBaseUrl.includes("staging")) return "staging";
  return "production";
}

/** `apiClient`·브라우저 직접 `POST /player/info` 등과 동일한 베이스 (공백 제거) */
export function getPublicApiBaseUrl(): string {
  const v =
    typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_API_BASE_URL : undefined;
  return (typeof v === "string" ? v : "").trim();
}

/** 상용 서브도메인 기준 도메인 (NEXT_PUBLIC_EXPERIENCE_BASE_DOMAIN으로 덮을 수 있음) */
const EXPERIENCE_BASE_DOMAIN =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_EXPERIENCE_BASE_DOMAIN) ||
  "dobedub.org";

// 플레이어용 도메인 종류
export type PlayerDomain = "experience" | "all";

// 브랜드별 베이스 URL
// - 상용: https://{brand}.dobedub.org
// - 개발: /sites/{brand}
function getBrandBaseUrl(brand: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    return `https://${brand}.${EXPERIENCE_BASE_DOMAIN}`;
  }
  return `/sites/${brand}`;
}

/**
 * 플레이어 라우팅 정책 (experience / all 공통).
 * - 상용: https://{brand}.dobedub.org/{domain}/player/{playerUuid}
 * - 개발: /sites/{brand}/{domain}/player/{playerUuid}
 */
export function getPlayerRouteHref(
  brand: string,
  domain: PlayerDomain,
  playerUuid: string,
): string {
  const base = getBrandBaseUrl(brand);
  return `${base}/${domain}/player/${playerUuid}`;
}

/**
 * 플레이어 뒤로가기 정책.
 * - 상용: https://{brand}.dobedub.org/{domain}
 * - 개발: /sites/{brand}/{domain}
 */
export function getPlayerBackHref(
  brand: string,
  domain: PlayerDomain,
): string {
  const base = getBrandBaseUrl(brand);
  return `${base}/${domain}`;
}

/**
 * 체험하기 플레이어 링크.
 * - 상용(NODE_ENV=production): 서브도메인 절대 URL (예: https://senior.dobedub.org/experience/player/xxx)
 * - 그 외: path 방식 (예: /sites/senior/experience/player/xxx)
 */
export function getExperiencePlayerHref(brand: string, playerUuid: string): string {
  return getPlayerRouteHref(brand, "experience", playerUuid);
}

/**
 * 체험하기 목록 링크 (플레이어 뒤로가기용).
 * - 상용: 서브도메인 절대 URL (예: https://senior.dobedub.org/experience)
 * - 그 외: path 방식 (예: /sites/senior/experience)
 */
export function getExperienceListHref(brand: string): string {
  return getPlayerBackHref(brand, "experience");
}
