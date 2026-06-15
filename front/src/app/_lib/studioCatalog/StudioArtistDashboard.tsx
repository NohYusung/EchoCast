'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { StudioCatalogIcon } from './StudioCatalogIcon';

type ProductStatus = 'live' | 'done' | 'draft';
type CharacterRole = 'starring' | 'supporting' | 'minor' | 'narrator' | 'unknown';
type ArtistKind = 'real' | 'tts';
type ArtistSex = 'F' | 'M' | 'N';
type ArtistAge = 'child' | 'teen' | 'young' | 'middle' | 'senior';
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
type VoiceArtist = {
    id: string;
    name: string;
    kind: ArtistKind;
    sex: ArtistSex;
    age: ArtistAge;
    tags: string[];
    color: string;
    note: string;
};
type ArtistDraft = Omit<VoiceArtist, 'id'>;

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4100';
const artistStorageKey = 'test-player:studio:artists:v1';
const colors = ['#5b9bff', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#2dd4bf', '#fb7185', '#60a5fa'];
const tagOptions = ['차분함', '밝음', '허스키', '저음', '고음', '감정연기', '내레이션', '소년', '소녀', '코믹'];
const sexLabels: Record<ArtistSex, string> = { F: '여성', M: '남성', N: '중성' };
const ageLabels: Record<ArtistAge, string> = {
    child: '아역',
    teen: '청소년',
    young: '청년',
    middle: '중년',
    senior: '노년',
};
const kindLabels: Record<ArtistKind, string> = { real: '성우', tts: 'TTS' };
const roleLabels: Record<CharacterRole, string> = {
    starring: '주연',
    supporting: '조연',
    minor: '단역',
    narrator: '나레이션',
    unknown: '역할 미정',
};
const productStatusLabels: Record<ProductStatus, string> = {
    live: '연재중',
    done: '완결',
    draft: '임시저장',
};

export function StudioArtistDashboard({ productId }: { productId: string }) {
    const [product, setProduct] = useState(() => getInitialProduct(productId));
    const [characters, setCharacters] = useState<CharacterListItem[]>([]);
    const [artists, setArtists] = useState<VoiceArtist[]>([]);
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [query, setQuery] = useState('');
    const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
    const [draggingArtistId, setDraggingArtistId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArtistId, setEditingArtistId] = useState<string | null>(null);
    const [draft, setDraft] = useState<ArtistDraft>(() => createArtistDraft());
    const [nameTouched, setNameTouched] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const storedArtists = readStoredArtists();
        setArtists(storedArtists);
        setSelectedArtistId(storedArtists[0]?.id ?? null);
        setAssignments(readAssignments(productId));
    }, [productId]);

    useEffect(() => {
        let ignore = false;
        const initialProduct = getInitialProduct(productId);

        setProduct(initialProduct);
        setCharacters([]);
        setIsLoading(true);
        setMessage('');

        Promise.all([retrieveProduct(resolveProductApiId(productId, initialProduct)), listCharacters(resolveProductApiId(productId, initialProduct))])
            .then(([retrievedProduct, listedCharacters]) => {
                if (ignore) return;
                setProduct(toProduct(retrievedProduct, initialProduct));
                setCharacters(listedCharacters);
            })
            .catch(() => {
                if (!ignore) {
                    setMessage('작품 또는 캐릭터 정보를 불러오지 못했습니다. 백엔드 API 상태를 확인해 주세요.');
                }
            })
            .finally(() => {
                if (!ignore) setIsLoading(false);
            });

        return () => {
            ignore = true;
        };
    }, [productId]);

    const filteredArtists = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return artists.filter((artist) => {
            if (!normalizedQuery) return true;

            return `${artist.name} ${artist.tags.join(' ')} ${kindLabels[artist.kind]} ${sexLabels[artist.sex]}`
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [artists, query]);

    const assignedCount = useMemo(() => {
        return characters.filter((character) => Boolean(assignments[String(character.id)])).length;
    }, [assignments, characters]);

    const selectedArtist = artists.find((artist) => artist.id === selectedArtistId) ?? null;
    const showNameError = nameTouched && !draft.name.trim();

    const openCreateModal = () => {
        setEditingArtistId(null);
        setDraft(createArtistDraft(colors[artists.length % colors.length]));
        setNameTouched(false);
        setIsModalOpen(true);
    };

    const openEditModal = (artist: VoiceArtist) => {
        setEditingArtistId(artist.id);
        setDraft({
            name: artist.name,
            kind: artist.kind,
            sex: artist.sex,
            age: artist.age,
            tags: [...artist.tags],
            color: artist.color,
            note: artist.note,
        });
        setNameTouched(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingArtistId(null);
        setNameTouched(false);
    };

    const saveArtist = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setNameTouched(true);

        const name = draft.name.trim();
        if (!name) return;

        const newArtistId = editingArtistId ?? `artist-${Date.now()}`;

        setArtists((current) => {
            const nextArtists = editingArtistId
                ? current.map((artist) => (artist.id === editingArtistId ? { ...artist, ...draft, name, tags: [...draft.tags] } : artist))
                : [{ id: newArtistId, ...draft, name, tags: [...draft.tags] }, ...current];

            writeStoredArtists(nextArtists);
            return nextArtists;
        });
        setSelectedArtistId(newArtistId);
        setMessage(editingArtistId ? '성우 정보를 저장했습니다.' : '성우를 등록했습니다.');
        closeModal();
    };

    const deleteArtist = () => {
        if (!editingArtistId) return;

        setArtists((current) => {
            const nextArtists = current.filter((artist) => artist.id !== editingArtistId);
            writeStoredArtists(nextArtists);
            return nextArtists;
        });
        setAssignments((current) => {
            const nextAssignments = Object.fromEntries(Object.entries(current).filter(([, artistId]) => artistId !== editingArtistId));
            writeAssignments(productId, nextAssignments);
            return nextAssignments;
        });
        setSelectedArtistId(null);
        setMessage('성우를 삭제하고 배정을 해제했습니다.');
        closeModal();
    };

    const assignArtist = (characterId: number, artistId: string | null) => {
        setAssignments((current) => {
            const key = String(characterId);
            const nextAssignments = { ...current };

            if (artistId) {
                nextAssignments[key] = artistId;
            } else {
                delete nextAssignments[key];
            }

            writeAssignments(productId, nextAssignments);
            return nextAssignments;
        });
    };

    const dropArtistOnCharacter = (event: DragEvent<HTMLElement>, characterId: number) => {
        event.preventDefault();
        const artistId = event.dataTransfer.getData('text/artist-id') || draggingArtistId;
        setDraggingArtistId(null);
        if (artistId) assignArtist(characterId, artistId);
    };

    const toggleTag = (tag: string) => {
        setDraft((current) => ({
            ...current,
            tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
        }));
    };

    return (
        <main className="tp-catalog" data-testid="studio-artist-dashboard">
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
                    <strong>성우</strong>
                </div>
                <div className="tp-spacer" />
                <label className="tp-topsearch">
                    <span className="sr-only">성우 검색</span>
                    <StudioCatalogIcon name="search" />
                    <input onChange={(event) => setQuery(event.target.value)} placeholder="성우 검색..." value={query} />
                    <kbd>/</kbd>
                </label>
                <button className="tp-new-btn" onClick={openCreateModal} type="button">
                    <StudioCatalogIcon name="plus" />
                    성우 등록
                </button>
                <div className="tp-avatar">TP</div>
            </header>

            <div className="tp-catalog-body">
                <StudioProductRail active="artists" productId={product.id} />
                <section className="tp-catalog-content">
                    <div className="tp-catalog-inner">
                        <Link className="tp-back" href={`/studio/products/${product.id}/episodes`}>
                            <StudioCatalogIcon name="chevronLeft" />
                            프로젝트 상세로
                        </Link>

                        <section className="tp-page-head compact">
                            <div>
                                <span className={`tp-status ${product.status}`}>{productStatusLabels[product.status]}</span>
                                <h1>성우 등록</h1>
                                <p>{product.title}의 캐릭터별 담당 성우와 녹음 준비 상태를 관리합니다.</p>
                            </div>
                            <span className="tp-count">
                                성우 {artists.length} · 캐릭터 {characters.length} · 배정 {assignedCount}
                            </span>
                        </section>

                        {message ? <p className={message.includes('못했습니다') ? 'tp-character-message is-error' : 'tp-character-message'}>{message}</p> : null}

                        <section className="tp-stats">
                            <StatCard icon="mic" label="성우 풀" value={artists.length} detail="브라우저 로컬 등록" tone="blue" />
                            <StatCard icon="users" label="캐릭터" value={characters.length} detail="작품 API 응답 기준" tone="teal" />
                            <StatCard icon="check" label="배정 완료" value={assignedCount} detail={`미배정 ${Math.max(0, characters.length - assignedCount)}`} tone="violet" />
                            <StatCard icon="asset" label="검색 결과" value={filteredArtists.length} detail="현재 필터 기준" tone="amber" />
                        </section>

                        <section className="tp-admin-grid artists">
                            <aside className="tp-admin-panel">
                                <div className="tp-admin-panel-head">
                                    <div>
                                        <h2>성우 라이브러리</h2>
                                        <p>카드를 선택하거나 캐릭터 슬롯으로 드래그하세요.</p>
                                    </div>
                                    <button className="tp-btn ghost mini" onClick={openCreateModal} type="button">
                                        <StudioCatalogIcon name="plus" />
                                        추가
                                    </button>
                                </div>
                                <div className="tp-artist-list">
                                    {filteredArtists.length > 0 ? (
                                        filteredArtists.map((artist) => {
                                            const isSelected = artist.id === selectedArtistId;
                                            const assignmentTotal = Object.values(assignments).filter((artistId) => artistId === artist.id).length;

                                            return (
                                                <article
                                                    className={`tp-artist-card ${isSelected ? 'is-selected' : ''}`}
                                                    draggable
                                                    key={artist.id}
                                                    onClick={() => setSelectedArtistId(artist.id)}
                                                    onDragEnd={() => setDraggingArtistId(null)}
                                                    onDragStart={(event) => {
                                                        setDraggingArtistId(artist.id);
                                                        event.dataTransfer.setData('text/artist-id', artist.id);
                                                        event.dataTransfer.effectAllowed = 'copy';
                                                    }}
                                                >
                                                    <span className="tp-artist-avatar" style={{ background: artist.color }}>
                                                        {artist.name.trim().charAt(0) || '?'}
                                                    </span>
                                                    <span className="tp-artist-meta">
                                                        <strong>
                                                            {artist.name}
                                                            <em>{kindLabels[artist.kind]}</em>
                                                        </strong>
                                                        <small>{sexLabels[artist.sex]} · {ageLabels[artist.age]} · 배정 {assignmentTotal}</small>
                                                        <span>
                                                            {artist.tags.slice(0, 3).map((tag) => <b key={tag}>{tag}</b>)}
                                                        </span>
                                                    </span>
                                                    <button
                                                        aria-label={`${artist.name} 편집`}
                                                        className="tp-card-icon"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openEditModal(artist);
                                                        }}
                                                        type="button"
                                                    >
                                                        <StudioCatalogIcon name="more" />
                                                    </button>
                                                </article>
                                            );
                                        })
                                    ) : (
                                        <div className="tp-empty compact">
                                            <StudioCatalogIcon name="mic" />
                                            <p>조건에 맞는 성우가 없습니다.</p>
                                        </div>
                                    )}
                                </div>
                            </aside>

                            <section className="tp-admin-panel wide">
                                <div className="tp-admin-panel-head">
                                    <div>
                                        <h2>캐릭터 성우 배정</h2>
                                        <p>선택한 성우를 각 캐릭터에 배정합니다.</p>
                                    </div>
                                    <span className="tp-count">{selectedArtist ? `선택: ${selectedArtist.name}` : '성우 선택 필요'}</span>
                                </div>
                                <div className="tp-casting-list">
                                    {isLoading ? (
                                        <div className="tp-character-empty">캐릭터 목록을 불러오는 중입니다.</div>
                                    ) : characters.length > 0 ? (
                                        characters.map((character, index) => {
                                            const assignedArtist = artists.find((artist) => artist.id === assignments[String(character.id)]);

                                            return (
                                                <article
                                                    className="tp-casting-row"
                                                    key={character.id}
                                                    onDragOver={(event) => event.preventDefault()}
                                                    onDrop={(event) => dropArtistOnCharacter(event, character.id)}
                                                >
                                                    <span
                                                        className={`tp-character-avatar ${character.imageUrl ? 'has-image' : ''}`}
                                                        style={
                                                            character.imageUrl
                                                                ? { backgroundImage: `url(${character.imageUrl})` }
                                                                : { background: colors[index % colors.length] }
                                                        }
                                                    >
                                                        {character.imageUrl ? null : character.name.trim().charAt(0) || '?'}
                                                    </span>
                                                    <span className="tp-character-meta">
                                                        <strong>
                                                            {character.name}
                                                            <em>{roleLabels[character.role]}</em>
                                                        </strong>
                                                        <small>캐릭터 ID {character.id}</small>
                                                    </span>
                                                    <span className={`tp-assignment-slot ${assignedArtist ? 'filled' : ''}`}>
                                                        {assignedArtist ? (
                                                            <>
                                                                <i style={{ background: assignedArtist.color }}>{assignedArtist.name.charAt(0)}</i>
                                                                <b>{assignedArtist.name}</b>
                                                                <small>{sexLabels[assignedArtist.sex]} · {ageLabels[assignedArtist.age]}</small>
                                                            </>
                                                        ) : (
                                                            <small>성우 미배정</small>
                                                        )}
                                                    </span>
                                                    <span className="tp-casting-actions">
                                                        <button
                                                            className="tp-btn ghost mini"
                                                            disabled={!selectedArtistId}
                                                            onClick={() => selectedArtistId && assignArtist(character.id, selectedArtistId)}
                                                            type="button"
                                                        >
                                                            배정
                                                        </button>
                                                        <button
                                                            className="tp-btn ghost mini"
                                                            disabled={!assignedArtist}
                                                            onClick={() => assignArtist(character.id, null)}
                                                            type="button"
                                                        >
                                                            해제
                                                        </button>
                                                    </span>
                                                </article>
                                            );
                                        })
                                    ) : (
                                        <div className="tp-character-empty">먼저 작품 상세에서 캐릭터를 등록해 주세요.</div>
                                    )}
                                </div>
                            </section>
                        </section>
                    </div>
                </section>
            </div>

            {isModalOpen ? (
                <div className="tp-modal-overlay compact" role="presentation">
                    <form aria-label="성우 등록" aria-modal="true" className="tp-episode-modal" onSubmit={saveArtist} role="dialog">
                        <div className="tp-modal-head">
                            <div>
                                <h2>{editingArtistId ? '성우 정보 편집' : '성우 등록'}</h2>
                                <p>이 정보는 현재 브라우저에 저장됩니다. 성우 API가 연결되면 서버 저장으로 교체됩니다.</p>
                            </div>
                            <button aria-label="닫기" onClick={closeModal} type="button">
                                <StudioCatalogIcon name="close" />
                            </button>
                        </div>
                        <div className="tp-form-col tp-scroll-form">
                            <label className="tp-field">
                                이름 / 활동명 <b>*</b>
                                <input
                                    className={showNameError ? 'error' : ''}
                                    onBlur={() => setNameTouched(true)}
                                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                                    placeholder="예: 한서윤"
                                    value={draft.name}
                                />
                                {showNameError ? <small className="tp-error">성우 이름을 입력해 주세요.</small> : null}
                            </label>

                            <div className="tp-field">
                                등록 유형
                                <div className="tp-segment">
                                    {(['real', 'tts'] as ArtistKind[]).map((kind) => (
                                        <button className={draft.kind === kind ? 'on' : ''} key={kind} onClick={() => setDraft((current) => ({ ...current, kind }))} type="button">
                                            {kindLabels[kind]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="tp-field">
                                성별 톤
                                <div className="tp-segment">
                                    {(['F', 'M', 'N'] as ArtistSex[]).map((sex) => (
                                        <button className={draft.sex === sex ? 'on' : ''} key={sex} onClick={() => setDraft((current) => ({ ...current, sex }))} type="button">
                                            {sexLabels[sex]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="tp-field">
                                연령대
                                <select onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value as ArtistAge }))} value={draft.age}>
                                    {(Object.keys(ageLabels) as ArtistAge[]).map((age) => <option key={age} value={age}>{ageLabels[age]}</option>)}
                                </select>
                            </label>

                            <div className="tp-field">
                                보이스 태그
                                <div className="tp-setting-chips">
                                    {tagOptions.map((tag) => (
                                        <button className={draft.tags.includes(tag) ? 'on' : ''} key={tag} onClick={() => toggleTag(tag)} type="button">
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="tp-field">
                                메모
                                <textarea
                                    onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                                    placeholder="녹음 가능 시간, 특징, 계약 메모"
                                    value={draft.note}
                                />
                            </label>

                            <div className="tp-field">
                                색상
                                <div className="tp-swatches">
                                    {colors.map((color) => (
                                        <button
                                            aria-label={`성우 색상 ${color}`}
                                            className={draft.color === color ? 'on' : ''}
                                            key={color}
                                            onClick={() => setDraft((current) => ({ ...current, color }))}
                                            style={{ background: color }}
                                            type="button"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="tp-modal-foot">
                            {editingArtistId ? (
                                <button className="tp-danger-text" onClick={deleteArtist} type="button">성우 삭제</button>
                            ) : (
                                <span />
                            )}
                            <div>
                                <button className="tp-btn ghost" onClick={closeModal} type="button">취소</button>
                                <button className="tp-btn primary" type="submit">{editingArtistId ? '저장' : '등록'}</button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}
        </main>
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
    suffix = '',
    tone,
    value,
}: {
    detail: string;
    icon: 'asset' | 'check' | 'mic' | 'users';
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

function createArtistDraft(color = colors[0]): ArtistDraft {
    return {
        name: '',
        kind: 'real',
        sex: 'F',
        age: 'young',
        tags: [],
        color,
        note: '',
    };
}

function seedArtists(): VoiceArtist[] {
    return [
        { id: 'artist-seoyun', name: '한서윤', kind: 'real', sex: 'F', age: 'young', tags: ['차분함', '감정연기'], color: '#f472b6', note: '주연 여성 톤' },
        { id: 'artist-dohyun', name: '민도현', kind: 'real', sex: 'M', age: 'young', tags: ['저음', '허스키'], color: '#5b9bff', note: '긴장감 있는 독백' },
        { id: 'artist-jiwoo', name: '이지우', kind: 'tts', sex: 'N', age: 'teen', tags: ['소년', '밝음'], color: '#34d399', note: '중성적 청소년 톤' },
    ];
}

function readStoredArtists() {
    if (typeof window === 'undefined') return seedArtists();

    try {
        const parsed = JSON.parse(window.localStorage.getItem(artistStorageKey) || 'null') as VoiceArtist[] | null;
        if (parsed && parsed.length > 0) return parsed;
    } catch {
        return seedArtists();
    }

    const seededArtists = seedArtists();
    writeStoredArtists(seededArtists);
    return seededArtists;
}

function writeStoredArtists(artists: VoiceArtist[]) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(artistStorageKey, JSON.stringify(artists));
    } catch {
        // localStorage failure should not block screen interaction.
    }
}

function assignmentStorageKey(productId: string) {
    return `test-player:studio:products:${productId}:artist-assignments:v1`;
}

function readAssignments(productId: string) {
    if (typeof window === 'undefined') return {};

    try {
        return JSON.parse(window.localStorage.getItem(assignmentStorageKey(productId)) || '{}') as Record<string, string>;
    } catch {
        return {};
    }
}

function writeAssignments(productId: string, assignments: Record<string, string>) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(assignmentStorageKey(productId), JSON.stringify(assignments));
    } catch {
        // localStorage failure should not block screen interaction.
    }
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

async function retrieveProduct(productId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}`, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`Product retrieve failed: ${response.status}`);
    }

    const result = (await response.json()) as ProductRetrieveResponse;
    return result.data;
}

async function listCharacters(productId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/characters`, { cache: 'no-store' });

    if (!response.ok) {
        throw new Error(`Character list failed: ${response.status}`);
    }

    const result = (await response.json()) as CharacterListResponse;
    return result.data.items;
}
