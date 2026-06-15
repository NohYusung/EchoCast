'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { StudioCatalogIcon } from './StudioCatalogIcon';

type StudioProductStatus = 'live' | 'done' | 'draft';
type StudioEpisodeStatus = 'published' | 'editing' | 'render' | 'draft';
type EpisodeFilter = 'all' | 'published' | 'editing' | 'draft';
type CharacterRole = 'starring' | 'supporting' | 'minor' | 'narrator' | 'unknown';
type StudioProduct = {
    id: string;
    legacyId: string;
    title: string;
    status: StudioProductStatus;
    genres: string[];
    episodeCount: number;
    rating: string;
    updatedAtLabel: string;
    progress: number;
    cover: string;
    logline: string;
};
type StudioEpisode = {
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
};
type CharacterListItem = {
    id: number;
    productId: number;
    name: string;
    role: CharacterRole;
    imageUrl?: string;
};
type CharacterListResponse = {
    data: {
        items: CharacterListItem[];
        total: number;
    };
};
type CharacterCreateRequest = {
    name: string;
    role: CharacterRole;
    imageUrl?: string;
};
type ProductUpdateRequest = {
    coverImageUrl?: string;
};
type FileUploadUrlItem = {
    publicUrl: string;
    mimetype: string;
    presignedUrl: string;
};
type FileUploadUrlsResponse = {
    data: FileUploadUrlItem[];
};
type ProductSettingsDraft = Pick<StudioProduct, 'title' | 'status' | 'rating' | 'genres' | 'cover' | 'logline'>;
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

const filterLabels: Record<EpisodeFilter, string> = {
    all: '전체',
    published: '발행',
    editing: '작업중',
    draft: '임시저장',
};
const productStatusLabels: Record<StudioProductStatus, string> = {
    live: '연재중',
    done: '완결',
    draft: '임시저장',
};
const episodeStatusLabels: Record<StudioEpisodeStatus, string> = {
    published: '발행',
    editing: '작업중',
    render: '렌더 대기',
    draft: '임시저장',
};
const productStatusOptions: StudioProductStatus[] = ['live', 'done', 'draft'];
const genreOptions = ['로맨스', '판타지', '스릴러', '드라마', '액션', '일상', '코미디', '공포', '학원', '무협', 'SF', 'BL'];
const ratingOptions = ['전체', '12+', '15+', '19+'];
const characterRoleOptions: CharacterRole[] = ['starring', 'supporting', 'minor', 'narrator', 'unknown'];
const characterRoleLabels: Record<CharacterRole, string> = {
    starring: '주연',
    supporting: '조연',
    minor: '단역',
    narrator: '나레이션',
    unknown: '역할 미정',
};
const coverOptions = [
    'linear-gradient(135deg,#1d4ed8,#38bdf8)',
    'linear-gradient(135deg,#7c2d12,#f59e0b)',
    'linear-gradient(135deg,#134e4a,#10b981)',
    'linear-gradient(135deg,#4c1d95,#a78bfa)',
    'linear-gradient(135deg,#831843,#f472b6)',
    'linear-gradient(135deg,#0f172a,#334155)',
    'linear-gradient(135deg,#b91c1c,#fb7185)',
    'linear-gradient(135deg,#1e293b,#0ea5e9)',
];
const characterAvatarColors = ['#5b9bff', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#2dd4bf'];
const productApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100';

export function StudioEpisodeDashboard({ productId }: { productId?: string }) {
    const [product, setProduct] = useState(() => getInitialStudioProduct(productId));
    const [episodes, setEpisodes] = useState<StudioEpisode[]>([]);
    const [characters, setCharacters] = useState<CharacterListItem[]>([]);
    const [filter, setFilter] = useState<EpisodeFilter>('all');
    const [query, setQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCharacterModalOpen, setIsCharacterModalOpen] = useState(false);
    const [isCharacterCreateModalOpen, setIsCharacterCreateModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [newEpisodeNumber, setNewEpisodeNumber] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newSubTitle, setNewSubTitle] = useState('');
    const [newCharacterName, setNewCharacterName] = useState('');
    const [newCharacterRole, setNewCharacterRole] = useState<CharacterRole>('unknown');
    const [newCharacterImageFile, setNewCharacterImageFile] = useState<File | null>(null);
    const [settingsCoverImageFile, setSettingsCoverImageFile] = useState<File | null>(null);
    const [settingsCoverImagePreviewUrl, setSettingsCoverImagePreviewUrl] = useState<string | null>(null);
    const [settingsDraft, setSettingsDraft] = useState<ProductSettingsDraft>(() => toProductSettingsDraft(getInitialStudioProduct(productId)));
    const [episodeNumberTouched, setEpisodeNumberTouched] = useState(false);
    const [titleTouched, setTitleTouched] = useState(false);
    const [characterNameTouched, setCharacterNameTouched] = useState(false);
    const [settingsTitleTouched, setSettingsTitleTouched] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCharacterLoading, setIsCharacterLoading] = useState(false);
    const [isCharacterSubmitting, setIsCharacterSubmitting] = useState(false);
    const [isSettingsSubmitting, setIsSettingsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [characterError, setCharacterError] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        const initialProduct = getInitialStudioProduct(productId);

        setProduct(initialProduct);
        setEpisodes([]);
        setCharacters([]);
        setCharacterError(null);
        setSettingsDraft(toProductSettingsDraft(initialProduct));
        setSettingsCoverImageFile(null);
        setSettingsCoverImagePreviewUrl(null);

        if (!productId) {
            return () => {
                ignore = true;
            };
        }

        retrieveProduct(resolveProductApiId(productId, initialProduct))
            .then((retrievedProduct) => {
                if (!ignore) {
                    setProduct(toStudioProduct(retrievedProduct, initialProduct));
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

        setIsCharacterLoading(true);
        listCharacters(resolveProductApiId(productId, initialProduct))
            .then((items) => {
                if (!ignore) {
                    setCharacters(items);
                    setCharacterError(null);
                }
            })
            .catch(() => {
                if (!ignore) {
                    setCharacterError('캐릭터 목록을 불러오지 못했습니다. 백엔드 API 상태를 확인해 주세요.');
                }
            })
            .finally(() => {
                if (!ignore) {
                    setIsCharacterLoading(false);
                }
            });

        return () => {
            ignore = true;
        };
    }, [productId]);

    useEffect(() => {
        return () => {
            if (settingsCoverImagePreviewUrl) {
                URL.revokeObjectURL(settingsCoverImagePreviewUrl);
            }
        };
    }, [settingsCoverImagePreviewUrl]);

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
    const parsedEpisodeNumber = Number(newEpisodeNumber);
    const isValidEpisodeNumber = Number.isInteger(parsedEpisodeNumber) && parsedEpisodeNumber > 0;
    const showEpisodeNumberError = episodeNumberTouched && !isValidEpisodeNumber;
    const showTitleError = titleTouched && !newTitle.trim();
    const showCharacterNameError = characterNameTouched && !newCharacterName.trim();
    const showSettingsTitleError = settingsTitleTouched && !settingsDraft.title.trim();

    const openCreateModal = () => {
        setSubmitError(null);
        setNewEpisodeNumber((current) => current || String(getNextEpisodeNumber(episodes)));
        setIsModalOpen(true);
    };

    const closeCreateModal = () => {
        if (isSubmitting) return;

        setSubmitError(null);
        setIsModalOpen(false);
    };

    const createEpisode = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setEpisodeNumberTouched(true);
        setTitleTouched(true);
        setSubmitError(null);

        const title = newTitle.trim();
        if (!title || !isValidEpisodeNumber) return;

        setIsSubmitting(true);

        const subTitle = newSubTitle.trim() || undefined;

        try {
            await createEpisodeApi({
                productId: productId ?? product.id,
                episodeNumber: parsedEpisodeNumber,
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
        setNewEpisodeNumber('');
        setNewTitle('');
        setNewSubTitle('');
        setEpisodeNumberTouched(false);
        setTitleTouched(false);
        setFilter('all');
        setIsSubmitting(false);
    };

    const openCharacterModal = () => {
        setIsCharacterModalOpen(true);
        setCharacterError(null);
        setIsCharacterLoading(true);
        listCharacters(resolveProductApiId(productId, product))
            .then((items) => {
                setCharacters(items);
            })
            .catch(() => {
                setCharacterError('캐릭터 목록을 불러오지 못했습니다. 백엔드 API 상태를 확인해 주세요.');
            })
            .finally(() => {
                setIsCharacterLoading(false);
            });
    };

    const closeCharacterModal = () => {
        if (isCharacterSubmitting) return;

        setCharacterError(null);
        setIsCharacterModalOpen(false);
        setIsCharacterCreateModalOpen(false);
    };

    const openCharacterCreateModal = () => {
        setCharacterError(null);
        setNewCharacterName('');
        setNewCharacterRole('unknown');
        setNewCharacterImageFile(null);
        setCharacterNameTouched(false);
        setIsCharacterCreateModalOpen(true);
    };

    const closeCharacterCreateModal = () => {
        if (isCharacterSubmitting) return;

        setCharacterError(null);
        setNewCharacterName('');
        setNewCharacterRole('unknown');
        setNewCharacterImageFile(null);
        setCharacterNameTouched(false);
        setIsCharacterCreateModalOpen(false);
    };

    const createCharacter = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCharacterNameTouched(true);
        setCharacterError(null);

        const name = newCharacterName.trim();
        if (!name) return;
        if (newCharacterImageFile && !newCharacterImageFile.type.startsWith('image/')) {
            setCharacterError('캐릭터 이미지는 이미지 파일만 등록할 수 있습니다.');
            return;
        }

        setIsCharacterSubmitting(true);

        try {
            const apiProductId = resolveProductApiId(productId, product);
            let imageUrl: string | undefined;

            if (newCharacterImageFile) {
                const key = getCharacterImageUploadKey(apiProductId, newCharacterImageFile);
                const [uploadUrl] = await getFileUploadUrls(productApiBaseUrl, [key]);

                if (!uploadUrl) {
                    throw new Error('File upload URL response is empty');
                }

                await uploadFileToPresignedUrl(uploadUrl.presignedUrl, newCharacterImageFile);
                imageUrl = uploadUrl.publicUrl;
            }

            await createCharacterApi(apiProductId, {
                name,
                role: newCharacterRole,
                imageUrl,
            });

            const listedCharacters = await listCharacters(apiProductId);
            setCharacters(listedCharacters);
            setNewCharacterName('');
            setNewCharacterRole('unknown');
            setNewCharacterImageFile(null);
            setCharacterNameTouched(false);
            setIsCharacterCreateModalOpen(false);
        } catch {
            setCharacterError('캐릭터 등록에 실패했습니다. 백엔드 API 상태를 확인해 주세요.');
        } finally {
            setIsCharacterSubmitting(false);
        }
    };

    const resetSettingsCoverImage = () => {
        setSettingsCoverImageFile(null);
        setSettingsCoverImagePreviewUrl(null);
    };

    const selectSettingsCoverImage = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0] ?? null;
        event.currentTarget.value = '';

        if (!file) return;

        if (!file.type.startsWith('image/')) {
            resetSettingsCoverImage();
            setSettingsDraft((current) => ({
                ...current,
                cover: product.cover,
            }));
            setSettingsMessage('작품 이미지는 이미지 파일만 등록할 수 있습니다.');
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setSettingsMessage('');
        setSettingsCoverImageFile(file);
        setSettingsCoverImagePreviewUrl(previewUrl);
        setSettingsDraft((current) => ({
            ...current,
            cover: toCoverBackground(previewUrl),
        }));
    };

    const clearSettingsCoverImage = () => {
        resetSettingsCoverImage();
        setSettingsMessage('');
        setSettingsDraft((current) => ({
            ...current,
            cover: product.cover,
        }));
    };

    const openSettingsModal = () => {
        resetSettingsCoverImage();
        setSettingsDraft(toProductSettingsDraft(product));
        setSettingsTitleTouched(false);
        setSettingsMessage('');
        setIsSettingsModalOpen(true);
    };

    const closeSettingsModal = () => {
        if (isSettingsSubmitting) return;

        resetSettingsCoverImage();
        setSettingsMessage('');
        setIsSettingsModalOpen(false);
    };

    const toggleSettingsGenre = (genre: string) => {
        setSettingsDraft((current) => {
            if (current.genres.includes(genre)) {
                return {
                    ...current,
                    genres: current.genres.filter((item) => item !== genre),
                };
            }

            if (current.genres.length >= 3) {
                return current;
            }

            return {
                ...current,
                genres: [...current.genres, genre],
            };
        });
    };

    const saveProductSettings = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSettingsTitleTouched(true);
        setSettingsMessage('');

        const title = settingsDraft.title.trim();
        if (!title) return;
        if (settingsCoverImageFile && !settingsCoverImageFile.type.startsWith('image/')) {
            setSettingsMessage('작품 이미지는 이미지 파일만 등록할 수 있습니다.');
            return;
        }

        setIsSettingsSubmitting(true);

        try {
            const apiProductId = resolveProductApiId(productId, product);
            let uploadedCoverImageUrl: string | undefined;

            if (settingsCoverImageFile) {
                const key = getProductCoverUploadKey(apiProductId, settingsCoverImageFile);
                const [uploadUrl] = await getFileUploadUrls(productApiBaseUrl, [key]);

                if (!uploadUrl) {
                    throw new Error('File upload URL response is empty');
                }

                await uploadFileToPresignedUrl(uploadUrl.presignedUrl, settingsCoverImageFile);
                uploadedCoverImageUrl = uploadUrl.publicUrl;
                await updateProductApi(apiProductId, {
                    coverImageUrl: uploadedCoverImageUrl,
                });
            }

            setProduct((current) => ({
                ...current,
                title,
                status: settingsDraft.status,
                rating: settingsDraft.rating,
                genres: [...settingsDraft.genres],
                cover: uploadedCoverImageUrl ? toCoverBackground(uploadedCoverImageUrl) : settingsDraft.cover,
                logline: settingsDraft.logline.trim(),
                updatedAtLabel: '방금',
            }));
            resetSettingsCoverImage();
            setIsSettingsModalOpen(false);
            setSettingsMessage('');
        } catch {
            setSettingsMessage('작품 설정 저장에 실패했습니다. 백엔드 API 상태를 확인해 주세요.');
        } finally {
            setIsSettingsSubmitting(false);
        }
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
                    <Link href="/studio/products">프로젝트</Link>
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
                        <span>프로젝트</span>
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
                            프로젝트로
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
                                    <div><dt>총 보이스 클립</dt><dd>{statusCounts.voiceCount}</dd></div>
                                    <div><dt>최근 작업</dt><dd>{latestEpisode?.updatedAtLabel ?? product.updatedAtLabel}</dd></div>
                                </dl>
                                <div className="tp-hero-actions">
                                    {latestEpisode ? (
                                        <Link className="tp-btn primary" href={`/studio/products/${product.id}/episodes/${latestEpisode.id}`}>
                                            <StudioCatalogIcon name="play" />
                                            이어서 작업하기
                                        </Link>
                                    ) : null}
                                    <button className={latestEpisode ? 'tp-btn ghost' : 'tp-btn primary'} onClick={openCreateModal} type="button">
                                        <StudioCatalogIcon name="plus" />
                                        새 에피소드
                                    </button>
                                    <button className="tp-btn ghost" onClick={openCharacterModal} type="button">
                                        <StudioCatalogIcon name="users" />
                                        캐릭터 관리
                                    </button>
                                    <Link className="tp-btn ghost" href={`/studio/products/${product.id}/media`}>
                                        <StudioCatalogIcon name="image" />
                                        미디어 등록
                                    </Link>
                                    <Link className="tp-btn ghost" href={`/studio/products/${product.id}/artists`}>
                                        <StudioCatalogIcon name="mic" />
                                        성우 등록
                                    </Link>
                                    <button className="tp-btn ghost" onClick={openSettingsModal} type="button">
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
                                회차 번호 <b>*</b>
                                <input
                                    className={showEpisodeNumberError ? 'error' : ''}
                                    inputMode="numeric"
                                    min={1}
                                    onBlur={() => setEpisodeNumberTouched(true)}
                                    onChange={(event) => setNewEpisodeNumber(event.target.value)}
                                    placeholder="예: 7"
                                    step={1}
                                    type="number"
                                    value={newEpisodeNumber}
                                />
                                {showEpisodeNumberError ? <small className="tp-error">1 이상의 회차 번호를 입력해 주세요.</small> : null}
                            </label>
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
                                에피소드 부제
                                <input
                                    onChange={(event) => setNewSubTitle(event.target.value)}
                                    placeholder="예: 옥상에서의 대화"
                                    value={newSubTitle}
                                />
                            </label>
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
                                    {isSubmitting ? '등록 중' : '등록'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}

            {isCharacterModalOpen ? (
                <div className="tp-modal-overlay compact" role="presentation">
                    <section aria-label="캐릭터 관리" aria-modal="true" className="tp-management-modal" role="dialog">
                        <div className="tp-modal-head">
                            <div>
                                <h2>캐릭터 관리</h2>
                                <p>{product.title}에 등록된 캐릭터를 조회하고 새 캐릭터를 등록합니다.</p>
                            </div>
                            <button aria-label="닫기" onClick={closeCharacterModal} type="button">
                                <StudioCatalogIcon name="close" />
                            </button>
                        </div>
                        <div className="tp-form-col tp-scroll-form">
                            {characterError ? <p className="tp-character-message is-error" role="alert">{characterError}</p> : null}
                            {isCharacterLoading ? (
                                <div className="tp-character-empty">캐릭터 목록을 불러오는 중입니다.</div>
                            ) : characters.length > 0 ? (
                                <div className="tp-character-list">
                                    {characters.map((character, index) => (
                                        <article className="tp-character-card" key={character.id}>
                                            <span
                                                className={`tp-character-avatar ${character.imageUrl ? 'has-image' : ''}`}
                                                style={
                                                    character.imageUrl
                                                        ? { backgroundImage: `url(${character.imageUrl})` }
                                                        : { background: characterAvatarColors[index % characterAvatarColors.length] }
                                                }
                                            >
                                                {character.imageUrl ? null : character.name.trim().charAt(0) || '?'}
                                            </span>
                                            <span className="tp-character-meta">
                                                <strong>
                                                    {character.name}
                                                    <em>{characterRoleLabels[character.role]}</em>
                                                </strong>
                                                <small>캐릭터 ID {character.id}</small>
                                            </span>
                                            <span className="tp-character-stats">
                                                <span><b>{character.productId}</b>작품</span>
                                                <span><b>{character.id}</b>ID</span>
                                            </span>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="tp-character-empty">이 작품에 등록된 캐릭터가 아직 없습니다.</div>
                            )}
                        </div>
                        <div className="tp-modal-foot">
                            <span />
                            <div>
                                <button className="tp-btn ghost" onClick={closeCharacterModal} type="button">닫기</button>
                                <button className="tp-btn primary" onClick={openCharacterCreateModal} type="button">새 캐릭터 등록하기</button>
                            </div>
                        </div>
                    </section>
                </div>
            ) : null}

            {isCharacterCreateModalOpen ? (
                <div className="tp-modal-overlay compact" role="presentation">
                    <form aria-label="새 캐릭터" className="tp-episode-modal" onSubmit={createCharacter}>
                        <div className="tp-modal-head">
                            <div>
                                <h2>새 캐릭터</h2>
                                <p>{product.title}에 캐릭터 프로필을 등록합니다.</p>
                            </div>
                            <button aria-label="닫기" disabled={isCharacterSubmitting} onClick={closeCharacterCreateModal} type="button">
                                <StudioCatalogIcon name="close" />
                            </button>
                        </div>
                        <div className="tp-form-col">
                            <label className="tp-field">
                                캐릭터 이름 <b>*</b>
                                <input
                                    className={showCharacterNameError ? 'error' : ''}
                                    disabled={isCharacterSubmitting}
                                    onBlur={() => setCharacterNameTouched(true)}
                                    onChange={(event) => setNewCharacterName(event.target.value)}
                                    placeholder="예: 지후"
                                    value={newCharacterName}
                                />
                                {showCharacterNameError ? <small className="tp-error">캐릭터 이름을 입력해 주세요.</small> : null}
                            </label>
                            <div className="tp-field">
                                캐릭터 이미지
                                <label className="tp-character-image-picker">
                                    <span>{newCharacterImageFile ? newCharacterImageFile.name : '이미지 파일 선택'}</span>
                                    <input
                                        accept="image/*"
                                        disabled={isCharacterSubmitting}
                                        onChange={(event) => {
                                            const file = event.currentTarget.files?.[0] ?? null;
                                            event.currentTarget.value = '';

                                            if (file && !file.type.startsWith('image/')) {
                                                setCharacterError('캐릭터 이미지는 이미지 파일만 등록할 수 있습니다.');
                                                setNewCharacterImageFile(null);
                                                return;
                                            }

                                            setCharacterError(null);
                                            setNewCharacterImageFile(file);
                                        }}
                                        type="file"
                                    />
                                </label>
                                {newCharacterImageFile ? (
                                    <button className="tp-character-image-clear" disabled={isCharacterSubmitting} onClick={() => setNewCharacterImageFile(null)} type="button">
                                        선택 해제
                                    </button>
                                ) : null}
                            </div>
                            <div className="tp-field">
                                역할
                                <div className="tp-segment">
                                    {characterRoleOptions.map((role) => (
                                        <button
                                            className={newCharacterRole === role ? 'on' : ''}
                                            disabled={isCharacterSubmitting}
                                            key={role}
                                            onClick={() => setNewCharacterRole(role)}
                                            type="button"
                                        >
                                            {characterRoleLabels[role]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="tp-modal-foot">
                            <span
                                className={characterError ? 'tp-modal-foot-error' : undefined}
                                role={characterError ? 'alert' : undefined}
                            >
                                {characterError ?? ''}
                            </span>
                            <div>
                                <button className="tp-btn ghost" disabled={isCharacterSubmitting} onClick={closeCharacterCreateModal} type="button">취소</button>
                                <button className="tp-btn primary" disabled={isCharacterSubmitting} type="submit">
                                    {isCharacterSubmitting ? '등록 중' : '캐릭터 등록'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}

            {isSettingsModalOpen ? (
                <div className="tp-modal-overlay compact" role="presentation">
                    <form aria-label="작품 설정" aria-modal="true" className="tp-management-modal" onSubmit={saveProductSettings} role="dialog">
                        <div className="tp-modal-head">
                            <div>
                                <h2>작품 설정</h2>
                                <p>작품 상세 상단과 목록 카드에 표시되는 정보를 조정합니다.</p>
                            </div>
                            <button aria-label="닫기" disabled={isSettingsSubmitting} onClick={closeSettingsModal} type="button">
                                <StudioCatalogIcon name="close" />
                            </button>
                        </div>
                        <div className="tp-form-col tp-scroll-form">
                            <label className="tp-field">
                                작품 제목 <b>*</b>
                                <input
                                    className={showSettingsTitleError ? 'error' : ''}
                                    disabled={isSettingsSubmitting}
                                    onBlur={() => setSettingsTitleTouched(true)}
                                    onChange={(event) => setSettingsDraft((current) => ({ ...current, title: event.target.value }))}
                                    placeholder="작품 제목"
                                    value={settingsDraft.title}
                                />
                                {showSettingsTitleError ? <small className="tp-error">작품 제목을 입력해 주세요.</small> : null}
                            </label>
                            <label className="tp-field">
                                한 줄 소개 <span>작품 카드와 상세 상단에 표시돼요</span>
                                <textarea
                                    disabled={isSettingsSubmitting}
                                    onChange={(event) => setSettingsDraft((current) => ({ ...current, logline: event.target.value }))}
                                    placeholder="작품을 한 문장으로 소개해 주세요"
                                    value={settingsDraft.logline}
                                />
                            </label>
                            <div className="tp-field">
                                연재 상태
                                <div className="tp-segment status">
                                    {productStatusOptions.map((status) => (
                                        <button
                                            className={settingsDraft.status === status ? 'on' : ''}
                                            data-status={status}
                                            disabled={isSettingsSubmitting}
                                            key={status}
                                            onClick={() => setSettingsDraft((current) => ({ ...current, status }))}
                                            type="button"
                                        >
                                            {productStatusLabels[status]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="tp-field">
                                연령 등급
                                <div className="tp-segment">
                                    {ratingOptions.map((rating) => (
                                        <button
                                            className={settingsDraft.rating === rating ? 'on' : ''}
                                            disabled={isSettingsSubmitting}
                                            key={rating}
                                            onClick={() => setSettingsDraft((current) => ({ ...current, rating }))}
                                            type="button"
                                        >
                                            {rating}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="tp-field">
                                장르 <span>최대 3개</span>
                                <div className="tp-setting-chips">
                                    {genreOptions.map((genre) => {
                                        const isSelected = settingsDraft.genres.includes(genre);

                                        return (
                                            <button
                                                className={isSelected ? 'on' : ''}
                                                disabled={isSettingsSubmitting || (!isSelected && settingsDraft.genres.length >= 3)}
                                                key={genre}
                                                onClick={() => toggleSettingsGenre(genre)}
                                                type="button"
                                            >
                                                {genre}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="tp-field">
                                작품 이미지
                                <label className="tp-character-image-picker">
                                    <span>{settingsCoverImageFile ? settingsCoverImageFile.name : '이미지 파일 선택'}</span>
                                    <input accept="image/*" disabled={isSettingsSubmitting} onChange={selectSettingsCoverImage} type="file" />
                                </label>
                                {settingsCoverImageFile ? (
                                    <button className="tp-character-image-clear" disabled={isSettingsSubmitting} onClick={clearSettingsCoverImage} type="button">
                                        선택 해제
                                    </button>
                                ) : null}
                            </div>
                            <div className="tp-field">
                                커버 색상
                                <div className="tp-swatches">
                                    {coverOptions.map((cover, index) => (
                                        <button
                                            aria-label={`커버 색상 ${index + 1}`}
                                            className={settingsDraft.cover === cover ? 'on' : ''}
                                            disabled={isSettingsSubmitting}
                                            key={cover}
                                            onClick={() => {
                                                resetSettingsCoverImage();
                                                setSettingsDraft((current) => ({ ...current, cover }));
                                            }}
                                            style={{ background: cover }}
                                            type="button"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="tp-modal-foot">
                            <button className="tp-danger-text" disabled={isSettingsSubmitting} onClick={() => setSettingsMessage('작품 삭제 API 연결 전입니다.')} type="button">
                                작품 삭제
                            </button>
                            <span role={settingsMessage ? 'status' : undefined}>{settingsMessage}</span>
                            <div>
                                <button className="tp-btn ghost" disabled={isSettingsSubmitting} onClick={closeSettingsModal} type="button">취소</button>
                                <button className="tp-btn primary" disabled={isSettingsSubmitting} type="submit">
                                    {isSettingsSubmitting ? '저장 중' : '변경사항 저장'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}
        </main>
    );
}

function toProductSettingsDraft(product: StudioProduct): ProductSettingsDraft {
    return {
        title: product.title,
        status: product.status,
        rating: product.rating,
        genres: [...product.genres],
        cover: product.cover,
        logline: product.logline,
    };
}

function getNextEpisodeNumber(episodes: StudioEpisode[]) {
    return Math.max(0, ...episodes.map((episode) => episode.episodeNumber)) + 1;
}

function resolveProductApiId(productId: string | undefined, product: StudioProduct) {
    if (productId && /^\d+$/.test(productId)) {
        return productId;
    }

    return product.legacyId || product.id;
}

function getCharacterImageUploadKey(productId: string, file: File) {
    const extension = file.name.split('.').filter(Boolean).pop()?.toLowerCase() || 'png';

    return `products/${productId}/characters/images/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

function getProductCoverUploadKey(productId: string, file: File) {
    const extension = file.name.split('.').filter(Boolean).pop()?.toLowerCase() || 'png';

    return `products/${productId}/covers/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

function toCoverBackground(url: string) {
    return `center / cover no-repeat url(${JSON.stringify(url)})`;
}

function getInitialStudioProduct(productId?: string): StudioProduct {
    const id = productId || '0';

    return {
        id,
        legacyId: id,
        title: '프로젝트',
        status: 'draft',
        genres: [],
        episodeCount: 0,
        rating: '15+',
        updatedAtLabel: '방금 전',
        progress: 0,
        cover: 'linear-gradient(135deg,#1e293b,#475569)',
        logline: '',
    };
}

async function retrieveProduct(productId: string) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products/${productId}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Product retrieve failed: ${response.status}`);
    }

    const result = (await response.json()) as ProductRetrieveResponse;
    return result.data;
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

async function listCharacters(productId: string) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products/${productId}/characters`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Character list failed: ${response.status}`);
    }

    const result = (await response.json()) as CharacterListResponse;
    return result.data.items;
}

async function createCharacterApi(productId: string, character: CharacterCreateRequest) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products/${productId}/characters`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(character),
    });

    if (!response.ok) {
        throw new Error(`Character create failed: ${response.status}`);
    }
}

async function updateProductApi(productId: string, product: ProductUpdateRequest) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products/${productId}`, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(product),
    });

    if (!response.ok) {
        throw new Error(`Product update failed: ${response.status}`);
    }
}

async function getFileUploadUrls(apiBaseUrl: string, keys: string[]) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/files/uploadUrls`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
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

function toStudioProduct(product: ProductListItem, fallbackProduct: StudioProduct) {
    const id = String(product.id);

    return {
        ...fallbackProduct,
        id,
        legacyId: id,
        title: product.title,
        cover: product.coverImageUrl ? toCoverBackground(product.coverImageUrl) : fallbackProduct.cover,
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
