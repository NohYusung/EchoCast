export type StudioProductStatus = 'live' | 'done' | 'draft';

export type StudioEpisodeStatus = 'published' | 'editing' | 'render' | 'draft';

export interface StudioProduct {
    id: string;
    legacyId: string;
    title: string;
    status: StudioProductStatus;
    genres: string[];
    episodeCount: number;
    rating: string;
    days: string[];
    updatedAtLabel: string;
    progress: number;
    cover: string;
    logline: string;
}

export interface StudioEpisode {
    id: string;
    episodeNumber: number;
    title: string;
    status: StudioEpisodeStatus;
    progress: number;
    thumbnail: string;
    durationLabel: string;
    voiceCount: number;
    cutCount: number;
    updatedAtLabel: string;
}

export const studioProducts: StudioProduct[] = [
    {
        id: 'product-100',
        legacyId: '1',
        title: '학원의 비밀',
        status: 'live',
        genres: ['스릴러', '드라마'],
        episodeCount: 7,
        rating: '15+',
        days: ['수', '토'],
        updatedAtLabel: '2시간 전',
        progress: 62,
        cover: 'linear-gradient(135deg,#1d4ed8,#38bdf8)',
        logline: '평범한 전학생이 마주한 학원의 진실',
    },
    {
        id: 'product-200',
        legacyId: '2',
        title: '리메이크 로맨스',
        status: 'live',
        genres: ['로맨스', '코미디'],
        episodeCount: 14,
        rating: '전체',
        days: ['월', '목'],
        updatedAtLabel: '어제',
        progress: 88,
        cover: 'linear-gradient(135deg,#f43f5e,#fb7185)',
        logline: '두 번째 인생, 이번엔 너를 놓치지 않아',
    },
    {
        id: 'product-300',
        legacyId: '3',
        title: '검은 숲의 계약자',
        status: 'done',
        genres: ['판타지', '액션', '무협'],
        episodeCount: 20,
        rating: '15+',
        days: [],
        updatedAtLabel: '3주 전',
        progress: 100,
        cover: 'linear-gradient(135deg,#0f766e,#34d399)',
        logline: '마지막 계약이 세계를 바꾼다',
    },
    {
        id: 'product-400',
        legacyId: '4',
        title: '무제 - 신작 기획',
        status: 'draft',
        genres: ['SF'],
        episodeCount: 0,
        rating: '15+',
        days: [],
        updatedAtLabel: '5일 전',
        progress: 8,
        cover: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
        logline: '',
    },
];

export const productStatusLabels: Record<StudioProductStatus, string> = {
    live: '연재중',
    done: '완결',
    draft: '임시저장',
};

export const episodeStatusLabels: Record<StudioEpisodeStatus, string> = {
    published: '발행',
    editing: '작업중',
    render: '렌더 대기',
    draft: '임시저장',
};

export const productById = new Map(studioProducts.map((product) => [product.id, product]));

export const productByLegacyId = new Map(
    studioProducts.map((product) => [product.legacyId, product]),
);

const episodeTitles = [
    '전학 첫날',
    '균열',
    '옥상에서의 대화',
    '지워진 이름',
    '계약자',
    '새벽의 추격',
    '마지막 수업',
    '되감기',
    '두 번째 약속',
    '검은 숲',
    '경계 너머',
    '마주 선 진실',
];

const episodeThumbs = [
    'linear-gradient(120deg,#1e3a8a,#0ea5e9)',
    'linear-gradient(120deg,#7c2d12,#f59e0b)',
    'linear-gradient(120deg,#134e4a,#10b981)',
    'linear-gradient(120deg,#4c1d95,#a78bfa)',
    'linear-gradient(120deg,#831843,#f472b6)',
    'linear-gradient(120deg,#1e293b,#475569)',
];

export function resolveStudioProduct(productId?: string) {
    if (!productId) return studioProducts[0]!;

    return productById.get(productId) ?? productByLegacyId.get(productId) ?? studioProducts[0]!;
}

export function buildMockEpisodes(product: StudioProduct): StudioEpisode[] {
    return Array.from({ length: product.episodeCount }, (_, index) => {
        const episodeNumber = product.episodeCount - index;
        const status = resolveEpisodeStatus(product.status, index);

        return {
            id: episodeNumber === 1 ? 'sample-player' : `episode-${episodeNumber}`,
            episodeNumber,
            title: `${episodeNumber}화 - ${episodeTitles[(episodeNumber - 1) % episodeTitles.length]}`,
            status,
            progress: resolveEpisodeProgress(status),
            thumbnail: episodeThumbs[(episodeNumber - 1) % episodeThumbs.length]!,
            durationLabel: formatDuration(60 + ((episodeNumber * 37) % 150)),
            voiceCount: 8 + ((episodeNumber * 13) % 26),
            cutCount: 14 + ((episodeNumber * 7) % 20),
            updatedAtLabel: index === 0 ? '방금' : index === 1 ? '어제' : `${index}일 전`,
        };
    });
}

function resolveEpisodeStatus(productStatus: StudioProductStatus, index: number): StudioEpisodeStatus {
    if (productStatus === 'done') return 'published';
    if (productStatus === 'draft') return 'draft';
    if (index === 0) return 'editing';
    if (index === 1) return 'render';

    return 'published';
}

function resolveEpisodeProgress(status: StudioEpisodeStatus) {
    if (status === 'published') return 100;
    if (status === 'render') return 88;
    if (status === 'editing') return 54;

    return 18;
}

function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');

    return `${minutes}:${seconds}`;
}
