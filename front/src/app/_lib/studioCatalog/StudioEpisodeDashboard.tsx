'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { StudioCatalogIcon } from './StudioCatalogIcon';
import {
    buildMockEpisodes,
    episodeStatusLabels,
    productStatusLabels,
    resolveStudioProduct,
    type StudioEpisode,
    type StudioEpisodeStatus,
} from './studioCatalogMock';

type EpisodeFilter = 'all' | 'published' | 'editing' | 'draft';
type EpisodeTemplate = 'blank' | 'prev' | 'import';
type EpisodeCreateRequest = {
    productId: string;
    episodeNumber: number;
    title: string;
    subTitle?: string;
};
type ProductListItem = {
    id: number;
    title: string;
    coverImageUrl?: string;
};
type ProductListResponse = {
    data: {
        items: ProductListItem[];
        total: number;
    };
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

const filterLabels: Record<EpisodeFilter, string> = {
    all: '전체',
    published: '발행',
    editing: '작업중',
    draft: '임시저장',
};
const productApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100';

export function StudioEpisodeDashboard({ productId }: { productId?: string }) {
    const [product, setProduct] = useState(() => resolveStudioProduct(productId));
    const [episodes, setEpisodes] = useState<StudioEpisode[]>(() => buildMockEpisodes(resolveStudioProduct(productId)));
    const [filter, setFilter] = useState<EpisodeFilter>('all');
    const [query, setQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newMemo, setNewMemo] = useState('');
    const [template, setTemplate] = useState<EpisodeTemplate>('blank');
    const [titleTouched, setTitleTouched] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        const fallbackProduct = resolveStudioProduct(productId);

        setProduct(fallbackProduct);
        setEpisodes(buildMockEpisodes(fallbackProduct));

        if (!productId) {
            return () => {
                ignore = true;
            };
        }

        listProducts()
            .then((items) => {
                const listedProduct = items.find((item) => String(item.id) === productId);
                if (!ignore && listedProduct) {
                    setProduct(toStudioProduct(listedProduct, fallbackProduct));
                }
            })
            .catch(() => undefined);

        listEpisodes(productId)
            .then((items) => {
                if (!ignore) {
                    setEpisodes(items.map(toStudioEpisode));
                }
            })
            .catch(() => undefined);

        return () => {
            ignore = true;
        };
    }, [productId]);

    const statusCounts = useMemo(() => {
        return episodes.reduce(
            (acc, episode) => {
                acc.all += 1;
                if (episode.status === 'published' || episode.status === 'render') acc.published += 1;
                if (episode.status === 'editing') acc.editing += 1;
                if (episode.status === 'draft') acc.draft += 1;
                acc.voiceCount += episode.voiceCount;
                return acc;
            },
            { all: 0, published: 0, editing: 0, draft: 0, voiceCount: 0 },
        );
    }, [episodes]);

    const visibleEpisodes = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return episodes.filter((episode) => {
            if (filter === 'published' && episode.status !== 'published' && episode.status !== 'render') return false;
            if (filter === 'editing' && episode.status !== 'editing') return false;
            if (filter === 'draft' && episode.status !== 'draft') return false;
            if (!normalizedQuery) return true;

            return episode.title.toLowerCase().includes(normalizedQuery);
        });
    }, [episodes, filter, query]);

    const latestEpisode = episodes[0];
    const showTitleError = titleTouched && !newTitle.trim();

    const openCreateModal = () => {
        setSubmitError(null);
        setIsModalOpen(true);
    };

    const closeCreateModal = () => {
        if (isSubmitting) return;

        setSubmitError(null);
        setIsModalOpen(false);
    };

    const createEpisode = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setTitleTouched(true);
        setSubmitError(null);

        const title = newTitle.trim();
        if (!title) return;

        setIsSubmitting(true);

        const nextEpisodeNumber = Math.max(0, ...episodes.map((episode) => episode.episodeNumber)) + 1;
        const subTitle = newMemo.trim() || undefined;

        try {
            await createEpisodeApi({
                productId: productId ?? product.id,
                episodeNumber: nextEpisodeNumber,
                title,
                subTitle,
            });
            const listedEpisodes = await listEpisodes(productId ?? product.id);
            setEpisodes(listedEpisodes.map(toStudioEpisode));
        } catch {
            setSubmitError('에피소드 생성에 실패했습니다. 백엔드 API 상태를 확인해 주세요.');
            setIsSubmitting(false);
            return;
        }

        setIsModalOpen(false);
        setNewTitle('');
        setNewMemo('');
        setTemplate('blank');
        setTitleTouched(false);
        setFilter('all');
        setIsSubmitting(false);
    };

    return (
        <main className="tp-catalog" data-testid="studio-episode-dashboard">
            <header className="tp-topbar">
                <Link className="tp-brand" href="/studio/products">
                    <span><StudioCatalogIcon name="asset" /></span>
                    Tooned
                </Link>
                <div className="tp-crumb">
                    <span>/</span>
                    <Link href="/studio/products">내 작품</Link>
                    <span>/</span>
                    <strong>{product.title}</strong>
                </div>
                <div className="tp-spacer" />
                <label className="tp-topsearch">
                    <span className="sr-only">에피소드 검색</span>
                    <StudioCatalogIcon name="search" />
                    <input onChange={(event) => setQuery(event.target.value)} placeholder="에피소드 검색..." value={query} />
                    <kbd>/</kbd>
                </label>
                <button className="tp-new-btn" onClick={openCreateModal} type="button">
                    <StudioCatalogIcon name="plus" />
                    새 에피소드
                </button>
                <div className="tp-avatar">TP</div>
            </header>

            <div className="tp-catalog-body">
                <nav className="tp-rail" aria-label="studio catalog">
                    <Link className="active" href="/studio/products">
                        <StudioCatalogIcon name="panel" />
                        <span>작품</span>
                    </Link>
                    <button type="button"><StudioCatalogIcon name="chart" /><span>통계</span></button>
                    <button type="button"><StudioCatalogIcon name="image" /><span>에셋</span></button>
                    <button type="button"><StudioCatalogIcon name="users" /><span>멤버</span></button>
                    <span className="tp-rail-spacer" />
                    <button type="button"><StudioCatalogIcon name="trash" /><span>휴지통</span></button>
                    <button type="button"><StudioCatalogIcon name="settings" /><span>설정</span></button>
                </nav>

                <section className="tp-catalog-content">
                    <div className="tp-catalog-inner narrow">
                        <Link className="tp-back" href="/studio/products">
                            <StudioCatalogIcon name="chevronLeft" />
                            내 작품으로
                        </Link>

                        <section className="tp-episode-hero">
                            <div className="tp-product-poster" style={{ background: product.cover }}>
                                <span>{product.rating}</span>
                            </div>
                            <div className="tp-episode-info">
                                <span className={`tp-status ${product.status}`}>{productStatusLabels[product.status]}</span>
                                <h1>{product.title}</h1>
                                {product.logline ? <p>{product.logline}</p> : null}
                                <div className="tp-tag-row">
                                    {product.genres.map((genre) => <span key={genre}>{genre}</span>)}
                                </div>
                                <dl className="tp-metrics">
                                    <div><dt>에피소드</dt><dd>{episodes.length}<small>편</small></dd></div>
                                    <div><dt>연재 요일</dt><dd>{product.days.length ? product.days.join(' · ') : '비정기'}</dd></div>
                                    <div><dt>총 보이스 클립</dt><dd>{statusCounts.voiceCount}</dd></div>
                                    <div><dt>최근 작업</dt><dd>{latestEpisode?.updatedAtLabel ?? product.updatedAtLabel}</dd></div>
                                </dl>
                                <div className="tp-hero-actions">
                                    {latestEpisode ? (
                                        <Link className="tp-btn primary" href={`/studio/products/${product.id}/episodes/${latestEpisode.id}`}>
                                            <StudioCatalogIcon name="play" />
                                            이어서 작업하기
                                        </Link>
                                    ) : (
                                        <button className="tp-btn primary" onClick={openCreateModal} type="button">
                                            <StudioCatalogIcon name="plus" />
                                            첫 에피소드 만들기
                                        </button>
                                    )}
                                    <button className="tp-btn ghost" onClick={openCreateModal} type="button">
                                        <StudioCatalogIcon name="plus" />
                                        새 에피소드
                                    </button>
                                    <button className="tp-btn ghost" type="button">
                                        <StudioCatalogIcon name="settings" />
                                        작품 설정
                                    </button>
                                </div>
                            </div>
                        </section>

                        <div className="tp-episode-head">
                            <div>
                                <h2>에피소드</h2>
                                <span>총 {episodes.length}편</span>
                            </div>
                            <div className="tp-tabs" role="tablist" aria-label="에피소드 상태 필터">
                                {(['all', 'published', 'editing', 'draft'] as EpisodeFilter[]).map((status) => (
                                    <button
                                        aria-selected={filter === status}
                                        className={filter === status ? 'on' : ''}
                                        key={status}
                                        onClick={() => setFilter(status)}
                                        role="tab"
                                        type="button"
                                    >
                                        {filterLabels[status]}
                                        <span>{statusCounts[status]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {episodes.length === 0 ? (
                            <div className="tp-empty spacious">
                                <StudioCatalogIcon name="asset" />
                                <h3>아직 에피소드가 없어요</h3>
                                <p>첫 에피소드를 만들어 웹툰 스트립에 목소리를 입혀 보세요.</p>
                                <button className="tp-btn primary" onClick={openCreateModal} type="button">
                                    <StudioCatalogIcon name="plus" />
                                    첫 에피소드 만들기
                                </button>
                            </div>
                        ) : (
                            <div className="tp-episode-list">
                                {visibleEpisodes.map((episode) => (
                                    <Link
                                        className="tp-episode-row"
                                        data-testid={`episode-row-${episode.id}`}
                                        href={`/studio/products/${product.id}/episodes/${episode.id}`}
                                        key={episode.id}
                                    >
                                        <span className="tp-episode-num"><b>{episode.episodeNumber}</b>EP</span>
                                        <span className="tp-episode-thumb" style={{ background: episode.thumbnail }}>
                                            <small>{episode.durationLabel}</small>
                                            <i><StudioCatalogIcon name="play" /></i>
                                        </span>
                                        <span className="tp-episode-main">
                                            <span>
                                                <strong>{episode.title}</strong>
                                                <em className={`tp-episode-badge ${episode.status}`}>{episodeStatusLabels[episode.status]}</em>
                                            </span>
                                            <small>
                                                <span><StudioCatalogIcon name="mic" /> 보이스 {episode.voiceCount}</span>
                                                <span>컷 {episode.cutCount}</span>
                                                <span>{episode.updatedAtLabel} 수정</span>
                                            </small>
                                        </span>
                                        <span className="tp-episode-progress">
                                            <small>{episode.progress}%</small>
                                            <i><b style={{ width: `${episode.progress}%` }} /></i>
                                        </span>
                                        <span className="tp-open-hint">편집기 열기 <StudioCatalogIcon name="chevronRight" /></span>
                                    </Link>
                                ))}
                                <button className="tp-episode-add" onClick={openCreateModal} type="button">
                                    <span><StudioCatalogIcon name="plus" /></span>
                                    <strong>새 에피소드 추가</strong>
                                    <small>스트립을 올리고 목소리를 입혀 보세요.</small>
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {isModalOpen ? (
                <div className="tp-modal-overlay compact" role="presentation">
                    <form aria-label="새 에피소드" className="tp-episode-modal" onSubmit={createEpisode}>
                        <div className="tp-modal-head">
                            <div>
                                <h2>새 에피소드</h2>
                                <p>{product.title}에 새 작업 공간을 만듭니다.</p>
                            </div>
                            <button aria-label="닫기" disabled={isSubmitting} onClick={closeCreateModal} type="button">
                                <StudioCatalogIcon name="close" />
                            </button>
                        </div>
                        <div className="tp-form-col">
                            <label className="tp-field">
                                에피소드 제목 <b>*</b>
                                <input
                                    className={showTitleError ? 'error' : ''}
                                    onBlur={() => setTitleTouched(true)}
                                    onChange={(event) => setNewTitle(event.target.value)}
                                    placeholder="예: 7화 - 옥상에서의 대화"
                                    value={newTitle}
                                />
                                {showTitleError ? <small className="tp-error">에피소드 제목을 입력해 주세요.</small> : null}
                            </label>
                            <label className="tp-field">
                                한 줄 메모
                                <input
                                    onChange={(event) => setNewMemo(event.target.value)}
                                    placeholder="이 화의 핵심 장면이나 메모"
                                    value={newMemo}
                                />
                            </label>
                            <div className="tp-template-grid">
                                {([
                                    ['blank', '빈 캔버스', '웹툰 스트립부터 새로 업로드'],
                                    ['prev', '이전 화 복제', '트랙·캐릭터 구성 그대로'],
                                    ['import', '스트립 가져오기', '컷 이미지 묶음 불러오기'],
                                ] as const).map(([value, label, description]) => (
                                    <button
                                        className={template === value ? 'on' : ''}
                                        key={value}
                                        onClick={() => setTemplate(value)}
                                        type="button"
                                    >
                                        <strong>{label}</strong>
                                        <small>{description}</small>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="tp-modal-foot">
                            <span
                                className={submitError ? 'tp-modal-foot-error' : undefined}
                                role={submitError ? 'alert' : undefined}
                            >
                                {submitError ?? ''}
                            </span>
                            <div>
                                <button className="tp-btn ghost" disabled={isSubmitting} onClick={closeCreateModal} type="button">취소</button>
                                <button className="tp-btn primary" disabled={isSubmitting} type="submit">
                                    {isSubmitting ? '생성 중' : '만들고 편집기 열기'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}
        </main>
    );
}

async function listProducts() {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Product list failed: ${response.status}`);
    }

    const result = (await response.json()) as ProductListResponse;
    return result.data.items;
}

async function listEpisodes(productId: string) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products/${productId}/episodes`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Episode list failed: ${response.status}`);
    }

    const result = (await response.json()) as EpisodeListResponse;
    return result.data.items;
}

function toStudioProduct(product: ProductListItem, fallbackProduct: ReturnType<typeof resolveStudioProduct>) {
    const id = String(product.id);

    return {
        ...fallbackProduct,
        id,
        legacyId: id,
        title: product.title,
        cover: product.coverImageUrl ? `center / cover no-repeat url(${JSON.stringify(product.coverImageUrl)})` : fallbackProduct.cover,
    };
}

function toStudioEpisode(episode: EpisodeListItem): StudioEpisode {
    return {
        id: String(episode.id),
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        status: 'editing',
        progress: 6,
        thumbnail: 'linear-gradient(120deg,#1e293b,#475569)',
        durationLabel: '0:00',
        voiceCount: 0,
        cutCount: 0,
        updatedAtLabel: '방금',
    };
}

async function createEpisodeApi({ productId, episodeNumber, title, subTitle }: EpisodeCreateRequest) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products/${productId}/episodes`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            episodeNumber,
            title,
            subTitle,
        }),
    });

    if (!response.ok) {
        throw new Error(`Episode create failed: ${response.status}`);
    }
}
