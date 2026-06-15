'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { StudioCatalogIcon } from './StudioCatalogIcon';

type ProductStatus = 'live' | 'done' | 'draft';
type MediaType = 'image' | 'video' | 'audio';
type MediaFilter = 'all' | MediaType;
type Product = {
    id: string;
    legacyId: string;
    title: string;
    status: ProductStatus;
    rating: string;
    cover: string;
    logline: string;
};
type ProductListItem = {
    id: number;
    title: string;
    coverImageUrl?: string;
};
type ProductRetrieveResponse = {
    data: ProductListItem;
};
type EpisodeListItem = {
    id: number;
    productId: string;
    episodeNumber: number;
    title: string;
    subTitle?: string;
};
type EpisodeListResponse = {
    data: {
        items: EpisodeListItem[];
        total: number;
    };
};
type MediaListItem = {
    id: number;
    episodeId: number;
    canvasId?: number;
    mediaName: string;
    mediaType: MediaType;
    mediaUrl: string;
    duration?: number;
};
type MediaListResponse = {
    data: {
        items: MediaListItem[];
        total: number;
    };
};
type CanvasMediaItem = {
    canvasMediaId?: number;
    mediaId: number;
    mediaName: string;
    mediaType: MediaType;
    mediaUrl: string;
    duration?: number;
    index?: number;
    startTime?: number;
    endTime?: number;
    sourceStartTime?: number;
    sourceEndTime?: number;
    volume?: number;
    isMuted?: boolean;
};
type CanvasListItem = {
    id: number;
    episodeId: number;
    mediaId?: number;
    mediaName?: string;
    mediaType?: MediaType;
    mediaUrl?: string;
    medias?: CanvasMediaItem[];
};
type CanvasListResponse = {
    data: {
        items: CanvasListItem[];
        total: number;
    };
};
type CanvasMediaRequestItem = {
    mediaId: number;
    index: number;
};
type FileUploadUrlItem = {
    publicUrl: string;
    mimetype: string;
    presignedUrl: string;
};
type FileUploadUrlsResponse = {
    data: FileUploadUrlItem[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100';
const mediaLabels: Record<MediaFilter, string> = {
    all: '전체',
    image: '이미지',
    video: '영상',
    audio: '오디오',
};
const productStatusLabels: Record<ProductStatus, string> = {
    live: '연재중',
    done: '완결',
    draft: '임시저장',
};

export function StudioProductMediaDashboard({ productId }: { productId: string }) {
    const [product, setProduct] = useState(() => getInitialProduct(productId));
    const [episodes, setEpisodes] = useState<EpisodeListItem[]>([]);
    const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
    const [mediaItems, setMediaItems] = useState<MediaListItem[]>([]);
    const [canvases, setCanvases] = useState<CanvasListItem[]>([]);
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
    const [selectedCanvasId, setSelectedCanvasId] = useState<number | null>(null);
    const [filter, setFilter] = useState<MediaFilter>('all');
    const [query, setQuery] = useState('');
    const [isLoadingShell, setIsLoadingShell] = useState(true);
    const [isLoadingEpisodeData, setIsLoadingEpisodeData] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let ignore = false;
        const initialProduct = getInitialProduct(productId);

        setProduct(initialProduct);
        setEpisodes([]);
        setSelectedEpisodeId('');
        setMessage('');
        setIsLoadingShell(true);

        Promise.all([retrieveProduct(resolveProductApiId(productId, initialProduct)), listEpisodes(productId)])
            .then(([retrievedProduct, listedEpisodes]) => {
                if (ignore) return;
                setProduct(toProduct(retrievedProduct, initialProduct));
                setEpisodes(listedEpisodes);
                setSelectedEpisodeId((current) => current || String(listedEpisodes[0]?.id ?? ''));
            })
            .catch(() => {
                if (!ignore) {
                    setMessage('작품 또는 에피소드 목록을 불러오지 못했습니다. 백엔드 API 상태를 확인해 주세요.');
                }
            })
            .finally(() => {
                if (!ignore) setIsLoadingShell(false);
            });

        return () => {
            ignore = true;
        };
    }, [productId]);

    useEffect(() => {
        if (!selectedEpisodeId) {
            setMediaItems([]);
            setCanvases([]);
            setSelectedCanvasId(null);
            setSelectedMediaIds([]);
            return;
        }

        let ignore = false;
        setIsLoadingEpisodeData(true);
        setMessage('');

        Promise.all([listMedia(selectedEpisodeId), listCanvases(selectedEpisodeId)])
            .then(([listedMedia, listedCanvases]) => {
                if (ignore) return;
                setMediaItems(listedMedia);
                setCanvases(listedCanvases);
                setSelectedCanvasId((current) => {
                    if (current && listedCanvases.some((canvas) => canvas.id === current)) return current;
                    return listedCanvases[0]?.id ?? null;
                });
                setSelectedMediaIds([]);
            })
            .catch(() => {
                if (!ignore) {
                    setMessage('선택 에피소드의 미디어 또는 캔버스를 불러오지 못했습니다.');
                }
            })
            .finally(() => {
                if (!ignore) setIsLoadingEpisodeData(false);
            });

        return () => {
            ignore = true;
        };
    }, [selectedEpisodeId]);

    const selectedEpisode = episodes.find((episode) => String(episode.id) === selectedEpisodeId) ?? null;
    const selectedCanvas = canvases.find((canvas) => canvas.id === selectedCanvasId) ?? null;

    const visibleMedia = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return mediaItems.filter((media) => {
            if (filter !== 'all' && media.mediaType !== filter) return false;
            if (!normalizedQuery) return true;

            return media.mediaName.toLowerCase().includes(normalizedQuery);
        });
    }, [filter, mediaItems, query]);

    const counts = useMemo(() => {
        return mediaItems.reduce(
            (acc, media) => {
                acc.all += 1;
                acc[media.mediaType] += 1;
                return acc;
            },
            { all: 0, image: 0, video: 0, audio: 0 }
        );
    }, [mediaItems]);

    const toggleMediaSelection = (mediaId: number) => {
        setSelectedMediaIds((current) => {
            if (current.includes(mediaId)) return current.filter((id) => id !== mediaId);

            return [...current, mediaId];
        });
    };

    const selectCanvasMedia = () => {
        setSelectedMediaIds((selectedCanvas?.medias ?? []).map((media) => media.mediaId));
    };

    const uploadMediaFiles = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = '';

        if (!selectedEpisodeId) {
            setMessage('먼저 에피소드를 선택해 주세요.');
            return;
        }

        if (files.length === 0) return;

        setIsUploading(true);
        setMessage('');

        try {
            for (const file of files) {
                const mediaType = getMediaType(file);
                const duration = await readMediaDuration(file, mediaType);
                const key = getMediaUploadKey(product.id, selectedEpisodeId, file);
                const [uploadUrl] = await getFileUploadUrls([key]);

                if (!uploadUrl) {
                    throw new Error('File upload URL response is empty');
                }

                await uploadFileToPresignedUrl(uploadUrl.presignedUrl, file);
                await createMedia(selectedEpisodeId, {
                    mediaName: file.name,
                    mediaType,
                    mediaUrl: uploadUrl.publicUrl,
                    duration,
                });
            }

            const listedMedia = await listMedia(selectedEpisodeId);
            setMediaItems(listedMedia);
            setMessage(`${files.length}개 미디어를 등록했습니다.`);
        } catch {
            setMessage('미디어 등록에 실패했습니다. 파일 업로드 API 상태를 확인해 주세요.');
        } finally {
            setIsUploading(false);
        }
    };

    const deleteMediaItem = async (mediaId: number) => {
        if (!selectedEpisodeId) return;

        setMessage('');

        try {
            await deleteMedia(selectedEpisodeId, mediaId);
            const [listedMedia, listedCanvases] = await Promise.all([listMedia(selectedEpisodeId), listCanvases(selectedEpisodeId)]);
            setMediaItems(listedMedia);
            setCanvases(listedCanvases);
            setSelectedMediaIds((current) => current.filter((id) => id !== mediaId));
            setMessage('미디어를 삭제했습니다.');
        } catch {
            setMessage('미디어 삭제에 실패했습니다.');
        }
    };

    const createCanvasFromSelection = async () => {
        if (!selectedEpisodeId || selectedMediaIds.length === 0) return;

        try {
            await createCanvas(selectedEpisodeId, toCanvasMediaRequest(selectedMediaIds));
            const listedCanvases = await listCanvases(selectedEpisodeId);
            setCanvases(listedCanvases);
            setSelectedCanvasId(listedCanvases[listedCanvases.length - 1]?.id ?? null);
            setMessage('선택 미디어로 캔버스를 생성했습니다.');
        } catch {
            setMessage('캔버스 생성에 실패했습니다.');
        }
    };

    const saveSelectedCanvas = async () => {
        if (!selectedEpisodeId || !selectedCanvas || selectedMediaIds.length === 0) return;

        try {
            await updateCanvas(selectedEpisodeId, selectedCanvas.id, toCanvasMediaRequest(selectedMediaIds));
            const listedCanvases = await listCanvases(selectedEpisodeId);
            setCanvases(listedCanvases);
            setMessage('캔버스 구성을 저장했습니다.');
        } catch {
            setMessage('캔버스 저장에 실패했습니다.');
        }
    };

    return (
        <main className="tp-catalog" data-testid="studio-product-media-dashboard">
            <header className="tp-topbar">
                <Link className="tp-brand" href="/studio/products">
                    <span><StudioCatalogIcon name="asset" /></span>
                    Tooned
                </Link>
                <div className="tp-crumb">
                    <span>/</span>
                    <Link href="/studio/products">프로젝트</Link>
                    <span>/</span>
                    <Link href={`/studio/products/${product.id}/episodes`}>{product.title}</Link>
                    <span>/</span>
                    <strong>미디어</strong>
                </div>
                <div className="tp-spacer" />
                <label className="tp-topsearch">
                    <span className="sr-only">미디어 검색</span>
                    <StudioCatalogIcon name="search" />
                    <input onChange={(event) => setQuery(event.target.value)} placeholder="미디어 검색..." value={query} />
                    <kbd>/</kbd>
                </label>
                <label className={`tp-new-btn ${isUploading ? 'is-disabled' : ''}`}>
                    <StudioCatalogIcon name="plus" />
                    {isUploading ? '업로드 중' : '미디어 등록'}
                    <input accept="image/*,video/*,audio/*" disabled={isUploading || !selectedEpisodeId} multiple onChange={uploadMediaFiles} type="file" />
                </label>
                <div className="tp-avatar">TP</div>
            </header>

            <div className="tp-catalog-body">
                <StudioProductRail active="media" productId={product.id} />
                <section className="tp-catalog-content">
                    <div className="tp-catalog-inner">
                        <Link className="tp-back" href={`/studio/products/${product.id}/episodes`}>
                            <StudioCatalogIcon name="chevronLeft" />
                            프로젝트 상세로
                        </Link>

                        <section className="tp-page-head compact">
                            <div>
                                <span className={`tp-status ${product.status}`}>{productStatusLabels[product.status]}</span>
                                <h1>프로젝트별 미디어 등록</h1>
                                <p>선택한 에피소드에 사용할 이미지, 영상, 오디오를 등록하고 캔버스 스트립에 연결합니다.</p>
                            </div>
                            <label className="tp-episode-picker">
                                에피소드
                                <select disabled={isLoadingShell || episodes.length === 0} onChange={(event) => setSelectedEpisodeId(event.target.value)} value={selectedEpisodeId}>
                                    {episodes.map((episode) => (
                                        <option key={episode.id} value={episode.id}>
                                            EP.{episode.episodeNumber} {episode.title}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </section>

                        {message ? <p className={message.includes('실패') || message.includes('못했습니다') ? 'tp-character-message is-error' : 'tp-character-message'}>{message}</p> : null}

                        <section className="tp-stats">
                            <StatCard icon="asset" label="전체 미디어" value={counts.all} detail={selectedEpisode ? `EP.${selectedEpisode.episodeNumber} 기준` : '에피소드 선택 필요'} tone="blue" />
                            <StatCard icon="image" label="이미지" value={counts.image} detail="컷/배경 미디어" tone="teal" />
                            <StatCard icon="play" label="영상" value={counts.video} detail="캔버스 삽입 영상" tone="violet" />
                            <StatCard icon="mic" label="오디오" value={counts.audio} detail="BGM/SFX/소스" tone="amber" />
                        </section>

                        {episodes.length === 0 ? (
                            <div className="tp-empty spacious">
                                <StudioCatalogIcon name="asset" />
                                <h3>에피소드가 없습니다</h3>
                                <p>미디어는 에피소드 단위 API에 저장됩니다. 먼저 에피소드를 생성해 주세요.</p>
                                <Link className="tp-btn primary" href={`/studio/products/${product.id}/episodes`}>
                                    프로젝트 상세로 이동
                                </Link>
                            </div>
                        ) : (
                            <section className="tp-admin-grid media">
                                <section className="tp-admin-panel">
                                    <div className="tp-admin-panel-head">
                                        <div>
                                            <h2>미디어 보관함</h2>
                                            <p>{isLoadingEpisodeData ? '불러오는 중' : `${visibleMedia.length}개 표시`}</p>
                                        </div>
                                        <div className="tp-tabs compact" role="tablist" aria-label="미디어 유형 필터">
                                            {(['all', 'image', 'video', 'audio'] as MediaFilter[]).map((type) => (
                                                <button
                                                    aria-selected={filter === type}
                                                    className={filter === type ? 'on' : ''}
                                                    key={type}
                                                    onClick={() => setFilter(type)}
                                                    role="tab"
                                                    type="button"
                                                >
                                                    {mediaLabels[type]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="tp-media-grid">
                                        {visibleMedia.length > 0 ? (
                                            visibleMedia.map((media) => (
                                                <article
                                                    className={`tp-media-card ${media.mediaType} ${selectedMediaIds.includes(media.id) ? 'is-selected' : ''}`}
                                                    key={media.id}
                                                    onClick={() => toggleMediaSelection(media.id)}
                                                >
                                                    <MediaPreview media={media} compact />
                                                    <span className="tp-media-meta">
                                                        <strong>{media.mediaName}</strong>
                                                        <small>{mediaLabels[media.mediaType]} · {formatDuration(media.duration)}</small>
                                                    </span>
                                                    <button
                                                        aria-label={`${media.mediaName} 삭제`}
                                                        className="tp-card-icon danger"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            deleteMediaItem(media.id);
                                                        }}
                                                        type="button"
                                                    >
                                                        <StudioCatalogIcon name="trash" />
                                                    </button>
                                                </article>
                                            ))
                                        ) : (
                                            <div className="tp-empty compact">
                                                <StudioCatalogIcon name="image" />
                                                <p>등록된 미디어가 없습니다.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <aside className="tp-admin-panel">
                                    <div className="tp-admin-panel-head">
                                        <div>
                                            <h2>캔버스 구성</h2>
                                            <p>선택한 미디어를 세로 스트립 캔버스로 묶습니다.</p>
                                        </div>
                                    </div>
                                    <div className="tp-canvas-actions">
                                        <button className="tp-btn primary" disabled={selectedMediaIds.length === 0} onClick={createCanvasFromSelection} type="button">
                                            <StudioCatalogIcon name="plus" />
                                            새 캔버스
                                        </button>
                                        <button className="tp-btn ghost" disabled={!selectedCanvas || selectedMediaIds.length === 0} onClick={saveSelectedCanvas} type="button">
                                            <StudioCatalogIcon name="check" />
                                            선택 캔버스 저장
                                        </button>
                                        <button className="tp-btn ghost" disabled={!selectedCanvas} onClick={selectCanvasMedia} type="button">
                                            현재 캔버스 불러오기
                                        </button>
                                    </div>
                                    <div className="tp-canvas-list">
                                        {canvases.length > 0 ? (
                                            canvases.map((canvas, index) => (
                                                <button
                                                    className={canvas.id === selectedCanvasId ? 'tp-canvas-row is-selected' : 'tp-canvas-row'}
                                                    key={canvas.id}
                                                    onClick={() => setSelectedCanvasId(canvas.id)}
                                                    type="button"
                                                >
                                                    <strong>캔버스 {index + 1}</strong>
                                                    <small>{canvas.medias?.length ?? 0}개 미디어 · ID {canvas.id}</small>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="tp-character-empty">아직 캔버스가 없습니다.</div>
                                        )}
                                    </div>
                                </aside>

                                <aside className="tp-admin-panel">
                                    <div className="tp-admin-panel-head">
                                        <div>
                                            <h2>캔버스 미리보기</h2>
                                            <p>{selectedCanvas ? `캔버스 ID ${selectedCanvas.id}` : '캔버스를 선택하세요'}</p>
                                        </div>
                                    </div>
                                    <div className="tp-strip-preview">
                                        {selectedCanvas?.medias && selectedCanvas.medias.length > 0 ? (
                                            selectedCanvas.medias
                                                .slice()
                                                .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
                                                .map((media, index) => (
                                                    <div className="tp-strip-item" key={`${media.canvasMediaId ?? media.mediaId}-${index}`}>
                                                        <span>{String(index + 1).padStart(2, '0')} · {media.mediaName}</span>
                                                        <MediaPreview media={toMediaListItem(media, selectedCanvas.episodeId)} compact={false} />
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="tp-character-empty">캔버스에 연결된 미디어가 없습니다.</div>
                                        )}
                                    </div>
                                </aside>
                            </section>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

function MediaPreview({ compact, media }: { compact: boolean; media: Pick<MediaListItem, 'mediaName' | 'mediaType' | 'mediaUrl'> }) {
    return (
        <span className={`tp-media-thumb ${compact ? 'compact' : ''} ${media.mediaType}`}>
            {media.mediaType === 'image' ? <img alt="" src={media.mediaUrl} /> : null}
            {media.mediaType === 'video' ? (
                <>
                    <video muted playsInline preload="metadata" src={media.mediaUrl} />
                    <i><StudioCatalogIcon name="play" /></i>
                </>
            ) : null}
            {media.mediaType === 'audio' ? <AudioWave /> : null}
            <b>{mediaLabels[media.mediaType]}</b>
        </span>
    );
}

function AudioWave() {
    return (
        <span className="tp-wave">
            {[44, 72, 36, 82, 54, 66, 28, 78, 46, 62, 34, 70].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
            ))}
        </span>
    );
}

function StudioProductRail({ active, productId }: { active: 'artists' | 'media' | 'products'; productId: string }) {
    return (
        <nav className="tp-rail" aria-label="studio product">
            <Link className={active === 'products' ? 'active' : ''} href={`/studio/products/${productId}/episodes`}>
                <StudioCatalogIcon name="panel" />
                <span>프로젝트</span>
            </Link>
            <Link className={active === 'media' ? 'active' : ''} href={`/studio/products/${productId}/media`}>
                <StudioCatalogIcon name="image" />
                <span>미디어</span>
            </Link>
            <Link className={active === 'artists' ? 'active' : ''} href={`/studio/products/${productId}/artists`}>
                <StudioCatalogIcon name="mic" />
                <span>성우</span>
            </Link>
            <span className="tp-rail-spacer" />
            <Link href="/studio/products">
                <StudioCatalogIcon name="chevronLeft" />
                <span>목록</span>
            </Link>
        </nav>
    );
}

function StatCard({
    detail,
    icon,
    label,
    tone,
    value,
}: {
    detail: string;
    icon: 'asset' | 'image' | 'mic' | 'play';
    label: string;
    tone: 'amber' | 'blue' | 'teal' | 'violet';
    value: number;
}) {
    return (
        <article className={`tp-stat ${tone}`}>
            <span>
                <StudioCatalogIcon name={icon} /> {label}
            </span>
            <strong>{value}</strong>
            <p>{detail}</p>
        </article>
    );
}

function getInitialProduct(productId: string): Product {
    return {
        id: productId,
        legacyId: productId,
        title: '프로젝트',
        status: 'draft',
        rating: '15+',
        cover: 'linear-gradient(135deg,#1e293b,#475569)',
        logline: '',
    };
}

function resolveProductApiId(productId: string, product: Product) {
    return /^\d+$/.test(productId) ? productId : product.legacyId;
}

function toCoverBackground(imageUrl: string) {
    return `center / cover no-repeat url(${JSON.stringify(imageUrl)})`;
}

function toProduct(product: ProductListItem, fallback: Product): Product {
    return {
        ...fallback,
        id: String(product.id),
        legacyId: String(product.id),
        title: product.title,
        cover: product.coverImageUrl ? toCoverBackground(product.coverImageUrl) : fallback.cover,
    };
}

function getMediaType(file: File): MediaType {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'image';
}

function getMediaUploadKey(productId: string, episodeId: string, file: File) {
    const extension = file.name.split('.').filter(Boolean).pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';

    return `products/${productId}/episodes/${episodeId}/medias/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

function toCanvasMediaRequest(mediaIds: number[]): CanvasMediaRequestItem[] {
    return mediaIds.map((mediaId, index) => ({ mediaId, index }));
}

function toMediaListItem(media: CanvasMediaItem, episodeId: number): MediaListItem {
    return {
        id: media.mediaId,
        episodeId,
        mediaName: media.mediaName,
        mediaType: media.mediaType,
        mediaUrl: media.mediaUrl,
        duration: media.duration,
    };
}

function formatDuration(duration?: number) {
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return '-';

    const seconds = Math.round(duration / 1000);
    const minute = Math.floor(seconds / 60);
    const second = String(seconds % 60).padStart(2, '0');

    return `${minute}:${second}`;
}

function readMediaDuration(file: File, mediaType: MediaType) {
    if (mediaType === 'image') return Promise.resolve(undefined);

    return new Promise<number | undefined>((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const element = document.createElement(mediaType === 'video' ? 'video' : 'audio');

        element.preload = 'metadata';
        element.onloadedmetadata = () => {
            const duration = Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined;
            URL.revokeObjectURL(objectUrl);
            resolve(duration);
        };
        element.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(undefined);
        };
        element.src = objectUrl;
    });
}

async function retrieveProduct(productId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}`, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`Product retrieve failed: ${response.status}`);
    }

    const result = (await response.json()) as ProductRetrieveResponse;
    return result.data;
}

async function listEpisodes(productId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/episodes`, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`Episode list failed: ${response.status}`);
    }

    const result = (await response.json()) as EpisodeListResponse;
    return result.data.items;
}

async function listMedia(episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/medias`, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`Media list failed: ${response.status}`);
    }

    const result = (await response.json()) as MediaListResponse;
    return result.data.items;
}

async function createMedia(
    episodeId: string,
    media: {
        mediaName: string;
        mediaType: MediaType;
        mediaUrl: string;
        duration?: number;
    }
) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/medias`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(media),
    });

    if (!response.ok) {
        throw new Error(`Media create failed: ${response.status}`);
    }
}

async function deleteMedia(episodeId: string, mediaId: number) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/medias/${mediaId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Media delete failed: ${response.status}`);
    }
}

async function listCanvases(episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/canvases`, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`Canvas list failed: ${response.status}`);
    }

    const result = (await response.json()) as CanvasListResponse;
    return result.data.items;
}

async function createCanvas(episodeId: string, medias: CanvasMediaRequestItem[]) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/canvases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ medias }),
    });

    if (!response.ok) {
        throw new Error(`Canvas create failed: ${response.status}`);
    }
}

async function updateCanvas(episodeId: string, canvasId: number, medias: CanvasMediaRequestItem[]) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/canvases/${canvasId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ medias }),
    });

    if (!response.ok) {
        throw new Error(`Canvas update failed: ${response.status}`);
    }
}

async function getFileUploadUrls(keys: string[]) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/files/uploadUrls`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keys }),
    });

    if (!response.ok) {
        throw new Error(`File upload URL request failed: ${response.status}`);
    }

    const result = (await response.json()) as FileUploadUrlsResponse;
    return result.data;
}

async function uploadFileToPresignedUrl(presignedUrl: string, file: File) {
    const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
    });

    if (!response.ok) {
        throw new Error(`File upload failed: ${response.status}`);
    }
}
