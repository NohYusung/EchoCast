'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ToonedBrand } from '../brand/ToonedBrand';
import { StudioCatalogIcon } from './StudioCatalogIcon';

type StudioProductStatus = 'live' | 'done' | 'draft';
type ProductFilter = 'all' | StudioProductStatus;
type ProductSort = 'recent' | 'name' | 'episodes';
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
type ProductListItem = {
    id: number;
    title: string;
    subtitle?: string;
    coverImageUrl?: string;
};
type ProductListResponse = {
    data: {
        items: ProductListItem[];
        total: number;
    };
};
type ProductMutationRequest = {
    title: string;
    subtitle?: string;
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

const genreOptions = ['로맨스', '판타지', '액션', '스릴러', '드라마', '코미디', '일상', '공포', '무협', 'SF'];
const visibilityOptions = ['비공개', '팀 공유', '공개'] as const;

const statusOrder: ProductFilter[] = ['all', 'live', 'done', 'draft'];
const productStatusLabels: Record<StudioProductStatus, string> = {
    live: '연재중',
    done: '완결',
    draft: '임시저장',
};
const productApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100';

export function StudioProductDashboard() {
    const [products, setProducts] = useState<StudioProduct[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);
    const [filter, setFilter] = useState<ProductFilter>('all');
    const [sort, setSort] = useState<ProductSort>('recent');
    const [query, setQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [logline, setLogline] = useState('');
    const [synopsis, setSynopsis] = useState('');
    const [rating, setRating] = useState('15+');
    const [ratio, setRatio] = useState('1080x2400');
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [visibility, setVisibility] = useState<(typeof visibilityOptions)[number]>('비공개');
    const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
    const [editingProduct, setEditingProduct] = useState<StudioProduct | null>(null);
    const [openMenuProductId, setOpenMenuProductId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<StudioProduct | null>(null);
    const [isDeletingProductId, setIsDeletingProductId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [titleTouched, setTitleTouched] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;

        setIsLoadingProducts(true);
        setProductsError(null);

        listProducts()
            .then((listedProducts) => {
                if (!ignore) {
                    setProducts(listedProducts);
                }
            })
            .catch(() => {
                if (!ignore) {
                    setProducts([]);
                    setProductsError('프로젝트 목록을 불러오지 못했습니다. 백엔드 API 상태를 확인해 주세요.');
                }
            })
            .finally(() => {
                if (!ignore) {
                    setIsLoadingProducts(false);
                }
            });

        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        if (!coverImageFile) {
            setCoverPreviewUrl(null);
            return undefined;
        }

        const objectUrl = URL.createObjectURL(coverImageFile);
        setCoverPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [coverImageFile]);

    useEffect(() => {
        if (!openMenuProductId) return undefined;

        const closeOnPointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Element &&
                (event.target.closest('.tp-product-menu') || event.target.closest('.tp-product-menu-button'))
            ) {
                return;
            }

            setOpenMenuProductId(null);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenMenuProductId(null);
            }
        };

        document.addEventListener('pointerdown', closeOnPointerDown);
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('pointerdown', closeOnPointerDown);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [openMenuProductId]);

    const counts = useMemo(() => {
        return products.reduce(
            (acc, product) => {
                acc.all += 1;
                acc[product.status] += 1;
                acc.episodes += product.episodeCount;
                return acc;
            },
            { all: 0, live: 0, done: 0, draft: 0, episodes: 0 }
        );
    }, [products]);

    const averageProgress = useMemo(() => {
        if (products.length === 0) return 0;

        return Math.round(products.reduce((sum, product) => sum + product.progress, 0) / products.length);
    }, [products]);

    const visibleProducts = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const filteredProducts = products.filter((product) => {
            if (filter !== 'all' && product.status !== filter) return false;
            if (!normalizedQuery) return true;

            return `${product.title} ${product.genres.join(' ')}`.toLowerCase().includes(normalizedQuery);
        });

        return [...filteredProducts].sort((a, b) => {
            if (sort === 'name') return a.title.localeCompare(b.title, 'ko');
            if (sort === 'episodes') return b.episodeCount - a.episodeCount;

            return Number(b.legacyId) - Number(a.legacyId);
        });
    }, [filter, products, query, sort]);

    const previewTitle = title.trim();
    const previewCover = coverPreviewUrl
        ? toCoverBackground(coverPreviewUrl)
        : (editingProduct?.cover ?? gradientFor(previewTitle || '무제'));
    const isEditingProduct = editingProduct !== null;
    const showTitleError = titleTouched && !previewTitle;

    const toggleGenre = (genre: string) => {
        setSelectedGenres((current) => {
            if (current.includes(genre)) return current.filter((item) => item !== genre);
            if (current.length >= 3) return current;

            return [...current, genre];
        });
    };

    const openCreateModal = () => {
        resetForm();
        setEditingProduct(null);
        setOpenMenuProductId(null);
        setSubmitError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (product: StudioProduct) => {
        setEditingProduct(product);
        setOpenMenuProductId(null);
        setDeleteError(null);
        setTitle(product.title);
        setLogline(product.logline);
        setSynopsis('');
        setRating(product.rating);
        setRatio('1080x2400');
        setSelectedGenres(product.genres);
        setVisibility('비공개');
        setCoverImageFile(null);
        setCoverPreviewUrl(null);
        setTitleTouched(false);
        setSubmitError(null);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (isSubmitting) return;

        setIsModalOpen(false);
        setEditingProduct(null);
        setSubmitError(null);
        resetForm();
    };

    const toggleProductMenu = (productId: string) => {
        setOpenMenuProductId((current) => (current === productId ? null : productId));
        setDeleteError(null);
    };

    const openDeleteConfirm = (product: StudioProduct) => {
        setDeleteTarget(product);
        setOpenMenuProductId(null);
        setDeleteError(null);
    };

    const closeDeleteConfirm = () => {
        if (isDeletingProductId) return;

        setDeleteTarget(null);
        setDeleteError(null);
    };

    const confirmDeleteProduct = async () => {
        if (!deleteTarget) return;

        const productToDelete = deleteTarget;
        setIsDeletingProductId(productToDelete.id);
        setDeleteError(null);

        try {
            await deleteProduct(productToDelete.id);
            setProducts((current) => current.filter((product) => product.id !== productToDelete.id));
            setDeleteTarget(null);
            if (editingProduct?.id === productToDelete.id) {
                setIsModalOpen(false);
                setEditingProduct(null);
                resetForm();
            }
        } catch {
            setDeleteError('프로젝트 삭제에 실패했습니다. 백엔드 API 상태를 확인해 주세요.');
        } finally {
            setIsDeletingProductId(null);
        }
    };

    const handleCoverImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;

        setSubmitError(null);

        if (!file) {
            setCoverImageFile(null);
            return;
        }

        if (!file.type.startsWith('image/')) {
            setCoverImageFile(null);
            setSubmitError('표지는 이미지 파일만 등록할 수 있습니다.');
            event.target.value = '';
            return;
        }

        setCoverImageFile(file);
    };

    const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setTitleTouched(true);
        setSubmitError(null);

        if (!previewTitle) return;
        if (coverImageFile && !coverImageFile.type.startsWith('image/')) {
            setSubmitError('표지는 이미지 파일만 등록할 수 있습니다.');
            return;
        }

        setIsSubmitting(true);

        try {
            let coverImageUrl: string | undefined;

            if (coverImageFile) {
                const key = getProductCoverUploadKey(coverImageFile);
                const [uploadUrl] = await getFileUploadUrls(productApiBaseUrl, [key]);

                if (!uploadUrl) {
                    throw new Error('File upload URL response is empty');
                }

                await uploadFileToPresignedUrl(uploadUrl.presignedUrl, coverImageFile);
                coverImageUrl = uploadUrl.publicUrl;
            }

            const trimmedLogline = logline.trim();
            const productRequest: ProductMutationRequest = {
                title: previewTitle,
                subtitle: isEditingProduct ? trimmedLogline : trimmedLogline || undefined,
            };
            if (coverImageUrl) {
                productRequest.coverImageUrl = coverImageUrl;
            }

            if (editingProduct) {
                await updateProduct(editingProduct.id, productRequest);
            } else {
                await createProduct(productRequest);
            }
            const listedProducts = await listProducts();
            setProducts(listedProducts);
        } catch {
            setSubmitError(
                isEditingProduct
                    ? '프로젝트 수정에 실패했습니다. 백엔드 API 상태를 확인해 주세요.'
                    : '프로젝트 등록에 실패했습니다. 백엔드 API 상태를 확인해 주세요.'
            );
            setIsSubmitting(false);
            return;
        }

        resetForm();
        setFilter('all');
        setQuery('');
        setIsModalOpen(false);
        setEditingProduct(null);
        setIsSubmitting(false);
    };

    const resetForm = () => {
        setTitle('');
        setLogline('');
        setSynopsis('');
        setRating('15+');
        setRatio('1080x2400');
        setSelectedGenres([]);
        setVisibility('비공개');
        setCoverImageFile(null);
        setCoverPreviewUrl(null);
        setTitleTouched(false);
    };

    return (
        <main className="tp-catalog" data-testid="studio-product-dashboard">
            <Topbar
                buttonLabel="새 프로젝트 등록"
                onPrimaryClick={openCreateModal}
                searchLabel="프로젝트 검색"
                searchPlaceholder="프로젝트 검색..."
                searchValue={query}
                setSearchValue={setQuery}
                title="프로젝트"
            />
            <div className="tp-catalog-body">
                <StudioRail active="products" />
                <section className="tp-catalog-content">
                    <div className="tp-catalog-inner">
                        <div className="tp-page-head">
                            <div>
                                <h1>프로젝트</h1>
                                <p>프로젝트를 등록하고 에피소드 단위로 영상을 제작하세요.</p>
                            </div>
                            <span className="tp-count">
                                프로젝트 {counts.all} · 에피소드 {counts.episodes}
                            </span>
                        </div>

                        <section className="tp-stats">
                            <StatCard
                                icon="panel"
                                label="등록 프로젝트"
                                value={counts.all}
                                detail={`연재중 ${counts.live} · 완결 ${counts.done} · 임시저장 ${counts.draft}`}
                                tone="blue"
                            />
                            <StatCard
                                icon="asset"
                                label="총 에피소드"
                                value={counts.episodes}
                                detail="API 응답 기준"
                                tone="teal"
                            />
                            <StatCard icon="mic" label="보이스 클립" value={0} detail="백엔드 응답 없음" tone="amber" />
                            <StatCard
                                icon="check"
                                label="완료율"
                                value={averageProgress}
                                suffix="%"
                                detail="등록 프로젝트 평균"
                                tone="violet"
                            />
                        </section>

                        <div className="tp-toolbar">
                            <div className="tp-tabs" role="tablist" aria-label="프로젝트 상태 필터">
                                {statusOrder.map((status) => (
                                    <button
                                        aria-selected={filter === status}
                                        className={filter === status ? 'on' : ''}
                                        key={status}
                                        onClick={() => setFilter(status)}
                                        role="tab"
                                        type="button"
                                    >
                                        {status === 'all' ? '전체' : productStatusLabels[status]}
                                        <span>{status === 'all' ? counts.all : counts[status]}</span>
                                    </button>
                                ))}
                            </div>
                            <label className="tp-sort">
                                <StudioCatalogIcon name="chart" />
                                <select onChange={(event) => setSort(event.target.value as ProductSort)} value={sort}>
                                    <option value="recent">최근 수정순</option>
                                    <option value="name">이름순</option>
                                    <option value="episodes">에피소드 많은순</option>
                                </select>
                            </label>
                        </div>

                        {isLoadingProducts ? (
                            <div className="tp-empty">
                                <StudioCatalogIcon name="search" />
                                <p>프로젝트 목록을 불러오는 중입니다.</p>
                            </div>
                        ) : productsError ? (
                            <div className="tp-empty">
                                <StudioCatalogIcon name="search" />
                                <p>{productsError}</p>
                            </div>
                        ) : (
                            <>
                                <div className="tp-product-grid">
                                    {visibleProducts.map((product) => (
                                        <article
                                            className="tp-product-card"
                                            data-testid={`product-card-${product.id}`}
                                            key={product.id}
                                        >
                                            <div className="tp-product-cover" style={{ background: product.cover }}>
                                                <Link
                                                    aria-label={`${product.title} 에피소드로 이동`}
                                                    className="tp-product-cover-link"
                                                    href={`/studio/products/${product.id}/episodes`}
                                                    onClick={() => setOpenMenuProductId(null)}
                                                />
                                                <span className={`tp-status ${product.status}`}>
                                                    {productStatusLabels[product.status]}
                                                </span>
                                                <span className="tp-rating">{product.rating}</span>
                                                <strong>{product.title}</strong>
                                                <button
                                                    aria-expanded={openMenuProductId === product.id}
                                                    aria-haspopup="menu"
                                                    aria-label={`${product.title} 더보기`}
                                                    className={`tp-product-menu-button${
                                                        openMenuProductId === product.id ? ' open' : ''
                                                    }`}
                                                    data-testid={`product-menu-button-${product.id}`}
                                                    onClick={() => toggleProductMenu(product.id)}
                                                    type="button"
                                                >
                                                    <StudioCatalogIcon name="more" />
                                                </button>
                                                <div
                                                    aria-hidden={openMenuProductId !== product.id}
                                                    className={`tp-product-menu${
                                                        openMenuProductId === product.id ? ' open' : ''
                                                    }`}
                                                    data-testid={`product-menu-${product.id}`}
                                                    role="menu"
                                                >
                                                    <button
                                                        onClick={() => openEditModal(product)}
                                                        role="menuitem"
                                                        type="button"
                                                    >
                                                        <StudioCatalogIcon name="edit" />
                                                        수정
                                                    </button>
                                                    <button
                                                        className="danger"
                                                        onClick={() => openDeleteConfirm(product)}
                                                        role="menuitem"
                                                        type="button"
                                                    >
                                                        <StudioCatalogIcon name="trash" />
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                            <Link
                                                className="tp-product-card-body"
                                                href={`/studio/products/${product.id}/episodes`}
                                                onClick={() => setOpenMenuProductId(null)}
                                            >
                                                <div className="tp-tag-row">
                                                    {product.genres.length ? (
                                                        product.genres.map((genre) => <span key={genre}>{genre}</span>)
                                                    ) : (
                                                        <span className="muted">장르 미설정</span>
                                                    )}
                                                </div>
                                                <div className="tp-card-meta">
                                                    <span>
                                                        <StudioCatalogIcon name="asset" /> EP {product.episodeCount}
                                                    </span>
                                                    <small>{product.updatedAtLabel}</small>
                                                </div>
                                                <div className="tp-progress">
                                                    <i style={{ width: `${product.progress}%` }} />
                                                </div>
                                            </Link>
                                        </article>
                                    ))}
                                    {filter === 'all' && !query ? (
                                        <button
                                            className="tp-product-card tp-add-card"
                                            onClick={openCreateModal}
                                            type="button"
                                        >
                                            <span className="tp-plus-box">
                                                <StudioCatalogIcon name="plus" />
                                            </span>
                                            <strong>새 프로젝트 등록</strong>
                                            <small>표지·장르·시놉시스를 입력해 새 프로젝트를 만드세요.</small>
                                        </button>
                                    ) : null}
                                </div>

                                {visibleProducts.length === 0 ? (
                                    <div className="tp-empty">
                                        <StudioCatalogIcon name="search" />
                                        <p>
                                            {query.trim() || filter !== 'all'
                                                ? '검색 결과가 없습니다.'
                                                : '등록된 프로젝트가 없습니다.'}
                                        </p>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                </section>
            </div>

            {isModalOpen ? (
                <div className="tp-modal-overlay" role="presentation">
                    <div aria-modal="true" className="tp-product-modal" role="dialog">
                        <div className="tp-modal-head">
                            <span>
                                <StudioCatalogIcon name={isEditingProduct ? 'edit' : 'plus'} />
                            </span>
                            <div>
                                <h2>{isEditingProduct ? '프로젝트 수정' : '새 프로젝트 등록'}</h2>
                                <p>
                                    {isEditingProduct
                                        ? '프로젝트 기본 정보를 수정합니다. 에피소드 작업 공간은 유지됩니다.'
                                        : '프로젝트 정보를 입력하면 첫 에피소드 작업 공간이 함께 생성됩니다.'}
                                </p>
                            </div>
                            <button aria-label="닫기" disabled={isSubmitting} onClick={closeModal} type="button">
                                <StudioCatalogIcon name="close" />
                            </button>
                        </div>

                        <form className="tp-modal-grid" onSubmit={submitProduct}>
                            <div className="tp-form-col">
                                <label className={`tp-dropzone ${coverImageFile ? 'has-file' : ''}`}>
                                    <input
                                        accept="image/*"
                                        disabled={isSubmitting}
                                        onChange={handleCoverImageChange}
                                        type="file"
                                    />
                                    <span>
                                        <StudioCatalogIcon name="download" />
                                    </span>
                                    <strong>{coverImageFile ? coverImageFile.name : '클릭하여 업로드'}</strong>
                                    <small>
                                        {coverImageFile
                                            ? isEditingProduct
                                                ? '수정 시 표지로 업로드됩니다.'
                                                : '등록 시 표지로 업로드됩니다.'
                                            : '프로젝트 표지 이미지 파일을 선택하세요.'}
                                    </small>
                                </label>

                                <label className="tp-field">
                                    프로젝트명 <b>*</b>
                                    <input
                                        className={showTitleError ? 'error' : ''}
                                        maxLength={40}
                                        onBlur={() => setTitleTouched(true)}
                                        onChange={(event) => setTitle(event.target.value)}
                                        placeholder="예: 학원의 비밀"
                                        value={title}
                                    />
                                    {showTitleError ? (
                                        <small className="tp-error">프로젝트명을 입력해 주세요.</small>
                                    ) : null}
                                </label>

                                <label className="tp-field">
                                    한 줄 소개 <span>{logline.length}/60</span>
                                    <input
                                        maxLength={60}
                                        onChange={(event) => setLogline(event.target.value)}
                                        placeholder="프로젝트를 한 문장으로 소개해 주세요."
                                        value={logline}
                                    />
                                </label>

                                <div className="tp-field">
                                    장르 <span>최대 3개</span>
                                    <div className="tp-chip-row">
                                        {genreOptions.map((genre) => (
                                            <button
                                                className={selectedGenres.includes(genre) ? 'on' : ''}
                                                key={genre}
                                                onClick={() => toggleGenre(genre)}
                                                type="button"
                                            >
                                                {genre}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="tp-two-col">
                                    <label className="tp-field">
                                        연령 등급
                                        <select onChange={(event) => setRating(event.target.value)} value={rating}>
                                            <option value="전체">전체 이용가</option>
                                            <option value="12+">12세 이용가</option>
                                            <option value="15+">15세 이용가</option>
                                            <option value="19+">19세 이용가</option>
                                        </select>
                                    </label>
                                    <label className="tp-field">
                                        기본 화면비
                                        <select onChange={(event) => setRatio(event.target.value)} value={ratio}>
                                            <option value="1080x2400">세로 9:20</option>
                                            <option value="1080x1920">세로 9:16</option>
                                            <option value="1080x1350">세로 4:5</option>
                                            <option value="1920x1080">가로 16:9</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="tp-field">
                                    시놉시스 <span>{synopsis.length}/500</span>
                                    <textarea
                                        maxLength={500}
                                        onChange={(event) => setSynopsis(event.target.value)}
                                        placeholder="프로젝트의 줄거리와 세계관을 자유롭게 작성해 주세요."
                                        value={synopsis}
                                    />
                                </label>

                                <div className="tp-radio-grid">
                                    {visibilityOptions.map((option) => (
                                        <button
                                            className={visibility === option ? 'on' : ''}
                                            key={option}
                                            onClick={() => setVisibility(option)}
                                            type="button"
                                        >
                                            <span />
                                            <strong>{option}</strong>
                                            <small>
                                                {option === '비공개'
                                                    ? '나만 볼 수 있어요'
                                                    : option === '팀 공유'
                                                      ? '초대 멤버에게 공개'
                                                      : '링크로 열람'}
                                            </small>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <aside className="tp-preview-col">
                                <p>미리보기</p>
                                <div className="tp-preview-card">
                                    <div className="tp-preview-cover" style={{ background: previewCover }}>
                                        <span>{isEditingProduct ? '수정 중' : '등록 예정'}</span>
                                        <strong>{previewTitle || '프로젝트명 미입력'}</strong>
                                    </div>
                                    <div className="tp-preview-body">
                                        <p>{logline || '한 줄 소개가 여기에 표시됩니다.'}</p>
                                        <div className="tp-tag-row">
                                            {selectedGenres.length ? (
                                                selectedGenres.map((genre) => <span key={genre}>{genre}</span>)
                                            ) : (
                                                <span className="muted">장르 미설정</span>
                                            )}
                                        </div>
                                        <dl>
                                            <div>
                                                <dt>연령 등급</dt>
                                                <dd>{rating}</dd>
                                            </div>
                                            <div>
                                                <dt>화면비</dt>
                                                <dd>{ratio}</dd>
                                            </div>
                                            <div>
                                                <dt>공개 범위</dt>
                                                <dd>{visibility}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                </div>
                            </aside>

                            <div className="tp-modal-foot">
                                <span
                                    className={submitError ? 'tp-modal-foot-error' : undefined}
                                    role={submitError ? 'alert' : undefined}
                                >
                                    {submitError ??
                                        (isEditingProduct
                                            ? '수정한 내용은 프로젝트 목록에 바로 반영됩니다.'
                                            : '등록 시 EP.01 작업 공간이 자동 생성됩니다.')}
                                </span>
                                <div>
                                    <button className="tp-btn primary" disabled={isSubmitting} type="submit">
                                        {isSubmitting ? (
                                            isEditingProduct ? (
                                                '수정 중'
                                            ) : (
                                                '등록 중'
                                            )
                                        ) : (
                                            <>
                                                <StudioCatalogIcon name="check" />{' '}
                                                {isEditingProduct ? '프로젝트 수정' : '프로젝트 등록'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {deleteTarget ? (
                <div className="tp-modal-overlay compact" role="presentation">
                    <div
                        aria-labelledby="tp-product-delete-title"
                        aria-modal="true"
                        className="tp-confirm-dialog"
                        role="dialog"
                    >
                        <span className="tp-confirm-icon danger">
                            <StudioCatalogIcon name="trash" />
                        </span>
                        <div>
                            <h2 id="tp-product-delete-title">프로젝트를 삭제할까요?</h2>
                            <p>
                                <b>{deleteTarget.title}</b> 프로젝트가 목록에서 삭제됩니다. 이 작업은 되돌릴 수
                                없습니다.
                            </p>
                        </div>
                        {deleteError ? (
                            <p className="tp-confirm-error" role="alert">
                                {deleteError}
                            </p>
                        ) : null}
                        <div className="tp-confirm-actions">
                            <button
                                className="tp-btn ghost"
                                disabled={Boolean(isDeletingProductId)}
                                onClick={closeDeleteConfirm}
                                type="button"
                            >
                                취소
                            </button>
                            <button
                                className="tp-btn danger"
                                disabled={Boolean(isDeletingProductId)}
                                onClick={confirmDeleteProduct}
                                type="button"
                            >
                                {isDeletingProductId === deleteTarget.id ? (
                                    '삭제 중'
                                ) : (
                                    <>
                                        <StudioCatalogIcon name="trash" /> 삭제
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
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
    return result.data.items.map(toStudioProduct);
}

async function createProduct(product: ProductMutationRequest) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(product),
    });

    if (!response.ok) {
        throw new Error(`Product create failed: ${response.status}`);
    }
}

async function updateProduct(productId: string, product: ProductMutationRequest) {
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

async function deleteProduct(productId: string) {
    const response = await fetch(`${productApiBaseUrl.replace(/\/$/, '')}/products/${productId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Product delete failed: ${response.status}`);
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

function toStudioProduct(product: ProductListItem): StudioProduct {
    const id = String(product.id);

    return {
        id,
        legacyId: id,
        title: product.title,
        status: 'live',
        genres: [],
        episodeCount: 0,
        rating: '15+',
        updatedAtLabel: '방금 전',
        progress: 0,
        cover: product.coverImageUrl ? toCoverBackground(product.coverImageUrl) : gradientFor(product.title),
        logline: product.subtitle ?? '',
    };
}

function getProductCoverUploadKey(file: File) {
    const extension = file.name
        .split('.')
        .filter(Boolean)
        .pop()
        ?.replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
    const safeExtension = extension || 'png';

    return `products/covers/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
}

function toCoverBackground(imageUrl: string) {
    return `center / cover no-repeat url(${JSON.stringify(imageUrl)})`;
}

function Topbar({
    buttonLabel,
    onPrimaryClick,
    searchLabel,
    searchPlaceholder,
    searchValue,
    setSearchValue,
    title,
}: {
    buttonLabel: string;
    onPrimaryClick: () => void;
    searchLabel: string;
    searchPlaceholder: string;
    searchValue: string;
    setSearchValue: (value: string) => void;
    title: string;
}) {
    return (
        <header className="tp-topbar">
            <Link className="tp-brand" href="/studio/products">
                <ToonedBrand />
            </Link>
            <div className="tp-crumb">
                <span>/</span>
                <strong>{title}</strong>
            </div>
            <div className="tp-spacer" />
            <label className="tp-topsearch">
                <span className="sr-only">{searchLabel}</span>
                <StudioCatalogIcon name="search" />
                <input
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder={searchPlaceholder}
                    value={searchValue}
                />
                <kbd>/</kbd>
            </label>
            <button className="tp-new-btn" onClick={onPrimaryClick} type="button">
                <StudioCatalogIcon name="plus" />
                {buttonLabel}
            </button>
            <div className="tp-avatar">TP</div>
        </header>
    );
}

function StudioRail({ active }: { active: 'products' | 'stats' }) {
    return (
        <nav className="tp-rail" aria-label="studio catalog">
            <Link className={active === 'products' ? 'active' : ''} href="/studio/products">
                <StudioCatalogIcon name="panel" />
                <span>프로젝트</span>
            </Link>
            <button className={active === 'stats' ? 'active' : ''} type="button">
                <StudioCatalogIcon name="chart" />
                <span>통계</span>
            </button>
            <button type="button">
                <StudioCatalogIcon name="image" />
                <span>에셋</span>
            </button>
            <Link href="/studio/admin">
                <StudioCatalogIcon name="users" />
                <span>권한</span>
            </Link>
            <span className="tp-rail-spacer" />
            <button type="button">
                <StudioCatalogIcon name="trash" />
                <span>휴지통</span>
            </button>
            <button type="button">
                <StudioCatalogIcon name="settings" />
                <span>설정</span>
            </button>
        </nav>
    );
}

function StatCard({
    detail,
    icon,
    label,
    suffix = '',
    tone,
    value,
}: {
    detail: string;
    icon: 'asset' | 'check' | 'mic' | 'panel';
    label: string;
    suffix?: string;
    tone: 'amber' | 'blue' | 'teal' | 'violet';
    value: number;
}) {
    return (
        <article className={`tp-stat ${tone}`}>
            <span>
                <StudioCatalogIcon name={icon} /> {label}
            </span>
            <strong>
                {value}
                <small>{suffix}</small>
            </strong>
            <p>{detail}</p>
        </article>
    );
}

function gradientFor(seed: string) {
    const gradients = [
        'linear-gradient(135deg,#3d5afe,#7b5bff)',
        'linear-gradient(135deg,#0ea5b7,#2dd4bf)',
        'linear-gradient(135deg,#f43f5e,#fb7185)',
        'linear-gradient(135deg,#7c3aed,#a78bfa)',
        'linear-gradient(135deg,#d97706,#fbbf24)',
        'linear-gradient(135deg,#0f766e,#34d399)',
    ];
    let hash = 0;
    for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

    return gradients[hash % gradients.length]!;
}
