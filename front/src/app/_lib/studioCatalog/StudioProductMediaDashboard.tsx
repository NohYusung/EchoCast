'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, DragEvent, FormEvent, KeyboardEvent, MouseEvent } from 'react';
import { ToonedBrand } from '../brand/ToonedBrand';
import { StudioCatalogIcon } from './StudioCatalogIcon';
import {
    toDialogueCueOverlayTop,
    toDialogueCuePositionRequest,
    toDialogueStripSize,
    toDialogueVisualId,
    toManualDialogueCuePositionRequest,
    toQuickDialogueCharacterRequest,
    type DialogueCuePositionRequest,
} from './studioDialogueCuePlacement';

type ProductStatus = 'live' | 'done' | 'draft';
type MediaType = 'image' | 'video' | 'audio';
type MediaFilter = 'all' | MediaType;
type SetupStepId = 'media' | 'canvas' | 'dialogue';
type CharacterRole = 'starring' | 'supporting' | 'minor' | 'narrator' | 'unknown';
type TrackApiType = 'scroll' | 'scrolls' | 'record' | 'audio' | 'effect' | 'bgm';
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
type TrackCueListItem = {
    id: number;
    script: string;
    characterId?: number;
    trackId: number;
    startTime: number;
    endTime: number;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startPosition: number;
    endPosition: number;
    volume: number;
};
type TrackListItem = {
    id: number;
    episodeId: number;
    name: string;
    type: TrackApiType;
    characterId?: number;
    isMuted: boolean;
    cues?: TrackCueListItem[];
};
type TrackListResponse = {
    data: {
        items: TrackListItem[];
        total: number;
    };
};
type TrackCreateRequest = {
    name: string;
    type: Extract<TrackApiType, 'record'>;
    characterId: number;
    isMuted?: boolean;
};
type CueCreateRequest = {
    script: string;
    startTime?: number;
    endTime?: number;
    startCanvasMediaId?: number;
    endCanvasMediaId?: number;
    startPosition?: number;
    endPosition?: number;
    volume?: number;
};
type CueUpdateRequest = {
    script?: string;
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
const setupSteps: Array<{ id: SetupStepId; title: string; description: string }> = [
    { id: 'media', title: '미디어', description: '컷 · 영상 · 오디오 등록' },
    { id: 'canvas', title: '캔버스', description: '이미지 스트립 구성' },
    { id: 'dialogue', title: '대사', description: '화자별 대사 입력' },
];
const characterRoleOptions: CharacterRole[] = ['starring', 'supporting', 'minor', 'narrator', 'unknown'];
const characterRoleLabels: Record<CharacterRole, string> = {
    starring: '주연',
    supporting: '조연',
    minor: '단역',
    narrator: '나레이션',
    unknown: '역할 미정',
};

export function StudioProductMediaDashboard({ productId }: { productId: string }) {
    const dialogueStripRef = useRef<HTMLDivElement | null>(null);
    const [product, setProduct] = useState(() => getInitialProduct(productId));
    const [episodes, setEpisodes] = useState<EpisodeListItem[]>([]);
    const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
    const [characters, setCharacters] = useState<CharacterListItem[]>([]);
    const [mediaItems, setMediaItems] = useState<MediaListItem[]>([]);
    const [canvases, setCanvases] = useState<CanvasListItem[]>([]);
    const [tracks, setTracks] = useState<TrackListItem[]>([]);
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
    const [selectedCanvasId, setSelectedCanvasId] = useState<number | null>(null);
    const [activeStep, setActiveStep] = useState<SetupStepId>('media');
    const [selectedSpeakerId, setSelectedSpeakerId] = useState('all');
    const [dialogueDraft, setDialogueDraft] = useState({ characterId: '', script: '' });
    const [quickCharacterName, setQuickCharacterName] = useState('');
    const [quickCharacterRole, setQuickCharacterRole] = useState<CharacterRole>('minor');
    const [cueScriptDrafts, setCueScriptDrafts] = useState<Record<number, string>>({});
    const [selectedCuePosition, setSelectedCuePosition] = useState<DialogueCuePositionRequest | null>(null);
    const [dialogueStripScale, setDialogueStripScale] = useState(100);
    const [filter, setFilter] = useState<MediaFilter>('all');
    const [isLoadingShell, setIsLoadingShell] = useState(true);
    const [isLoadingEpisodeData, setIsLoadingEpisodeData] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isCreatingDialogueCharacter, setIsCreatingDialogueCharacter] = useState(false);
    const [isSavingDialogue, setIsSavingDialogue] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        let ignore = false;
        const initialProduct = getInitialProduct(productId);

        setProduct(initialProduct);
        setEpisodes([]);
        setCharacters([]);
        setSelectedEpisodeId('');
        setActiveStep('media');
        setSelectedSpeakerId('all');
        setDialogueDraft({ characterId: '', script: '' });
        setQuickCharacterName('');
        setQuickCharacterRole('minor');
        setCueScriptDrafts({});
        setSelectedCuePosition(null);
        setMessage('');
        setIsLoadingShell(true);

        Promise.all([
            retrieveProduct(resolveProductApiId(productId, initialProduct)),
            listEpisodes(productId),
            listCharacters(resolveProductApiId(productId, initialProduct)),
        ])
            .then(([retrievedProduct, listedEpisodes, listedCharacters]) => {
                if (ignore) return;
                setProduct(toProduct(retrievedProduct, initialProduct));
                setEpisodes(listedEpisodes);
                setCharacters(listedCharacters);
                setSelectedEpisodeId((current) => current || String(listedEpisodes[0]?.id ?? ''));
                setDialogueDraft((current) => ({
                    ...current,
                    characterId:
                        current.characterId &&
                        listedCharacters.some((character) => String(character.id) === current.characterId)
                            ? current.characterId
                            : String(listedCharacters[0]?.id ?? ''),
                }));
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
            setTracks([]);
            setSelectedCanvasId(null);
            setSelectedMediaIds([]);
            setCueScriptDrafts({});
            setSelectedCuePosition(null);
            return;
        }

        let ignore = false;
        setIsLoadingEpisodeData(true);
        setSelectedCuePosition(null);
        setMessage('');

        Promise.all([listMedia(selectedEpisodeId), listCanvases(selectedEpisodeId), listTracks(selectedEpisodeId)])
            .then(([listedMedia, listedCanvases, listedTracks]) => {
                if (ignore) return;
                setMediaItems(listedMedia);
                setCanvases(listedCanvases);
                setTracks(listedTracks);
                setCueScriptDrafts(toCueScriptDrafts(listedTracks));
                setSelectedCanvasId((current) => {
                    if (current && listedCanvases.some((canvas) => canvas.id === current)) return current;
                    return listedCanvases[0]?.id ?? null;
                });
                setSelectedMediaIds([]);
                setSelectedCuePosition(null);
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

    const dialogueRows = useMemo(() => {
        return tracks
            .filter(isDialogueTrack)
            .flatMap((track) =>
                (track.cues ?? []).map((cue) => ({
                    cue,
                    track,
                    character: characters.find((character) => character.id === (cue.characterId ?? track.characterId)),
                }))
            )
            .sort((a, b) => a.cue.startTime - b.cue.startTime || a.cue.id - b.cue.id);
    }, [characters, tracks]);

    const visibleDialogueRows = useMemo(() => {
        if (selectedSpeakerId === 'all') return dialogueRows;

        return dialogueRows.filter(
            (row) => String(row.character?.id ?? row.track.characterId ?? '') === selectedSpeakerId
        );
    }, [dialogueRows, selectedSpeakerId]);

    const selectedSpeakerName =
        selectedSpeakerId === 'all'
            ? '전체 대사'
            : (characters.find((character) => String(character.id) === selectedSpeakerId)?.name ?? '선택 화자');

    const visibleMedia = useMemo(() => {
        return mediaItems.filter((media) => {
            if (filter !== 'all' && media.mediaType !== filter) return false;

            return true;
        });
    }, [filter, mediaItems]);

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
    const activeStepIndex = setupSteps.findIndex((step) => step.id === activeStep);
    const editorHref = selectedEpisodeId
        ? `/studio/products/${product.id}/episodes/${selectedEpisodeId}`
        : `/studio/products/${product.id}/episodes`;
    const currentEpisodeLabel = selectedEpisode
        ? `${product.title} · ${selectedEpisode.episodeNumber}화 · ${selectedEpisode.title}`
        : `${product.title} · 에피소드 선택 필요`;
    const progressWidth = `${((activeStepIndex + 1) / setupSteps.length) * 100}%`;
    const canvasDraftMediaIds = useMemo(() => {
        if (selectedMediaIds.length > 0) return selectedMediaIds;

        return (selectedCanvas?.medias ?? [])
            .slice()
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
            .map((media) => media.mediaId);
    }, [selectedCanvas, selectedMediaIds]);
    const canvasDraftItems = useMemo(() => {
        return canvasDraftMediaIds
            .map((mediaId) => {
                const catalogMedia = mediaItems.find((media) => media.id === mediaId);
                if (catalogMedia) return catalogMedia;

                const canvasMedia = selectedCanvas?.medias?.find((media) => media.mediaId === mediaId);
                return canvasMedia && selectedCanvas ? toMediaListItem(canvasMedia, selectedCanvas.episodeId) : null;
            })
            .filter((media): media is MediaListItem => Boolean(media));
    }, [canvasDraftMediaIds, mediaItems, selectedCanvas]);
    const selectedCanvasMediaItems = useMemo(() => {
        return (selectedCanvas?.medias ?? [])
            .slice()
            .filter((media) => media.mediaType !== 'audio')
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }, [selectedCanvas]);
    const selectedCuePositionMedia = selectedCuePosition
        ? selectedCanvasMediaItems.find((media) => media.canvasMediaId === selectedCuePosition.startCanvasMediaId)
        : undefined;
    const selectedCuePositionLabel = selectedCuePosition
        ? `${selectedCuePositionMedia?.mediaName ?? `미디어 ${selectedCuePosition.startCanvasMediaId}`} · ${selectedCuePosition.startPosition}%`
        : '위치 미선택';
    const firstSelectableCanvasMediaId = selectedCanvasMediaItems.find(
        (media) => typeof media.canvasMediaId === 'number'
    )?.canvasMediaId;
    const selectedCuePositionCanvasMediaId =
        selectedCuePosition?.startCanvasMediaId ?? firstSelectableCanvasMediaId ?? '';
    const dialogueStripSize = toDialogueStripSize(dialogueStripScale);
    const dialogueWorkspaceStyle = {
        '--tp-dialogue-strip-panel-width': `${dialogueStripSize.panelWidth}px`,
        '--tp-dialogue-strip-width': `${dialogueStripSize.width}px`,
    } as CSSProperties;

    const toggleMediaSelection = (mediaId: number) => {
        setSelectedMediaIds((current) => {
            if (current.includes(mediaId)) return current.filter((id) => id !== mediaId);

            return [...current, mediaId];
        });
    };

    const selectCanvasMedia = () => {
        setSelectedMediaIds((selectedCanvas?.medias ?? []).map((media) => media.mediaId));
        setSelectedCuePosition(null);
    };

    const moveCanvasDraftItem = (index: number, direction: -1 | 1) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= canvasDraftMediaIds.length) return;

        const nextIds = [...canvasDraftMediaIds];
        const [item] = nextIds.splice(index, 1);
        if (typeof item !== 'number') return;
        nextIds.splice(nextIndex, 0, item);
        setSelectedMediaIds(nextIds);
    };

    const removeCanvasDraftItem = (index: number) => {
        setSelectedMediaIds(canvasDraftMediaIds.filter((_, itemIndex) => itemIndex !== index));
    };

    const addCanvasDraftItem = (mediaId: number) => {
        setSelectedMediaIds((current) => {
            const base = current.length > 0 ? current : canvasDraftMediaIds;
            if (base.includes(mediaId)) return base;
            return [...base, mediaId];
        });
    };

    const updateDialogueStripScale = (value: string) => {
        const scale = Math.round(Number(value));
        if (!Number.isFinite(scale)) return;

        setDialogueStripScale(toDialogueStripSize(scale).scale);
    };

    const applyManualDialogueCuePosition = ({
        canvasMediaId,
        position,
    }: {
        canvasMediaId: number;
        position: number;
    }) => {
        const nextPosition = toManualDialogueCuePositionRequest({
            medias: selectedCanvasMediaItems,
            canvasMediaId,
            position,
        });

        if (!nextPosition) {
            setMessage('위치값은 0부터 100 사이로 입력해 주세요.');
            return;
        }

        setSelectedCuePosition(nextPosition);
        setMessage('대사 위치를 선택했습니다.');
    };

    const selectManualDialogueCueMedia = (value: string) => {
        const canvasMediaId = Number(value);
        if (!Number.isFinite(canvasMediaId)) return;

        applyManualDialogueCuePosition({
            canvasMediaId,
            position: selectedCuePosition?.startPosition ?? 50,
        });
    };

    const updateManualDialogueCuePosition = (value: string) => {
        if (value.trim() === '') {
            setSelectedCuePosition(null);
            return;
        }

        const position = Number(value);
        const canvasMediaId = selectedCuePosition?.startCanvasMediaId ?? firstSelectableCanvasMediaId;
        if (typeof canvasMediaId !== 'number') {
            setMessage('위치값을 입력할 캔버스 컷이 없습니다.');
            return;
        }

        applyManualDialogueCuePosition({ canvasMediaId, position });
    };

    const selectDialogueCuePosition = (event: MouseEvent<HTMLButtonElement>) => {
        const stripStack = dialogueStripRef.current?.querySelector<HTMLElement>('[data-dialogue-strip-stack]');

        if (!selectedCanvas || !stripStack || selectedCanvasMediaItems.length === 0) {
            setMessage('위치를 선택할 캔버스 스트립이 없습니다.');
            return;
        }

        const stripRect = stripStack.getBoundingClientRect();
        const visualSegments = Array.from(stripStack.querySelectorAll<HTMLElement>('[data-dialogue-visual-id]'))
            .map((element, index) => {
                const rect = element.getBoundingClientRect();
                const parsedIndex = Number(element.dataset.dialogueIndex);

                return {
                    id: element.dataset.dialogueVisualId ?? '',
                    canvasId: selectedCanvas.id,
                    index: Number.isFinite(parsedIndex) ? parsedIndex : index,
                    top: rect.top - stripRect.top,
                    height: rect.height,
                };
            })
            .filter(
                (segment) =>
                    segment.id && Number.isFinite(segment.top) && Number.isFinite(segment.height) && segment.height > 0
            );
        const position = toDialogueCuePositionRequest({
            canvasId: selectedCanvas.id,
            medias: selectedCanvasMediaItems,
            stripHeightPx: stripRect.height,
            stripPositionPx: event.clientY - stripRect.top,
            visualSegments,
        });

        if (!position) {
            setMessage('저장된 캔버스 미디어 위치를 확인할 수 없습니다. 캔버스 구성을 먼저 저장해 주세요.');
            return;
        }

        setSelectedCuePosition(position);
        setMessage('대사 위치를 선택했습니다.');
    };

    const refreshTracks = async () => {
        if (!selectedEpisodeId) return [] as TrackListItem[];

        const listedTracks = await listTracks(selectedEpisodeId);
        setTracks(listedTracks);
        setCueScriptDrafts(toCueScriptDrafts(listedTracks));
        return listedTracks;
    };

    const createQuickDialogueCharacter = async () => {
        const request = toQuickDialogueCharacterRequest({
            name: quickCharacterName,
            role: quickCharacterRole,
        });

        if (!request) {
            setMessage('추가할 캐릭터 이름을 입력해 주세요.');
            return;
        }

        setIsCreatingDialogueCharacter(true);
        setMessage('');

        try {
            const apiProductId = resolveProductApiId(productId, product);
            await createCharacter(apiProductId, request);
            const listedCharacters = await listCharacters(apiProductId);
            const createdCharacter =
                listedCharacters
                    .slice()
                    .reverse()
                    .find((character) => character.name === request.name && character.role === request.role) ??
                listedCharacters[listedCharacters.length - 1];

            setCharacters(listedCharacters);
            setQuickCharacterName('');

            if (createdCharacter) {
                const characterId = String(createdCharacter.id);
                setDialogueDraft((current) => ({
                    ...current,
                    characterId,
                }));
                setSelectedSpeakerId(characterId);
                setMessage(`${createdCharacter.name} 캐릭터를 추가하고 화자로 선택했습니다.`);
            } else {
                setMessage('캐릭터를 추가했습니다.');
            }
        } catch {
            setMessage('캐릭터 추가에 실패했습니다.');
        } finally {
            setIsCreatingDialogueCharacter(false);
        }
    };

    const createQuickDialogueCharacterOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        void createQuickDialogueCharacter();
    };

    const uploadMediaFileList = async (files: File[]) => {
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

    const uploadMediaFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = '';
        void uploadMediaFileList(files);
    };

    const dropMediaFiles = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        void uploadMediaFileList(Array.from(event.dataTransfer.files ?? []));
    };

    const deleteMediaItem = async (mediaId: number) => {
        if (!selectedEpisodeId) return;

        setMessage('');

        try {
            await deleteMedia(selectedEpisodeId, mediaId);
            const [listedMedia, listedCanvases] = await Promise.all([
                listMedia(selectedEpisodeId),
                listCanvases(selectedEpisodeId),
            ]);
            setMediaItems(listedMedia);
            setCanvases(listedCanvases);
            setSelectedMediaIds((current) => current.filter((id) => id !== mediaId));
            setSelectedCuePosition(null);
            setMessage('미디어를 삭제했습니다.');
        } catch {
            setMessage('미디어 삭제에 실패했습니다.');
        }
    };

    const createCanvasFromSelection = async () => {
        if (!selectedEpisodeId || canvasDraftMediaIds.length === 0) return;

        try {
            await createCanvas(selectedEpisodeId, toCanvasMediaRequest(canvasDraftMediaIds));
            const listedCanvases = await listCanvases(selectedEpisodeId);
            setCanvases(listedCanvases);
            setSelectedCanvasId(listedCanvases[listedCanvases.length - 1]?.id ?? null);
            setSelectedCuePosition(null);
            setMessage('선택 미디어로 캔버스를 생성했습니다.');
        } catch {
            setMessage('캔버스 생성에 실패했습니다.');
        }
    };

    const saveSelectedCanvas = async () => {
        if (!selectedEpisodeId || !selectedCanvas || canvasDraftMediaIds.length === 0) return;

        try {
            await updateCanvas(selectedEpisodeId, selectedCanvas.id, toCanvasMediaRequest(canvasDraftMediaIds));
            const listedCanvases = await listCanvases(selectedEpisodeId);
            setCanvases(listedCanvases);
            setSelectedCuePosition(null);
            setMessage('캔버스 구성을 저장했습니다.');
        } catch {
            setMessage('캔버스 저장에 실패했습니다.');
        }
    };

    const createDialogueCue = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedEpisodeId) return;

        const characterId = Number(dialogueDraft.characterId);
        const script = dialogueDraft.script.trim();

        if (!Number.isInteger(characterId) || characterId <= 0) {
            setMessage('대사를 등록할 캐릭터를 선택해 주세요.');
            return;
        }
        if (!script) {
            setMessage('대사를 입력해 주세요.');
            return;
        }
        if (!selectedCuePosition) {
            setMessage('이미지 스트립에서 대사를 넣을 위치를 선택해 주세요.');
            return;
        }

        try {
            setIsSavingDialogue(true);
            setMessage('');
            const track = await ensureDialogueTrack({
                characterId,
                characters,
                episodeId: selectedEpisodeId,
                tracks,
                onTracks: (nextTracks) => {
                    setTracks(nextTracks);
                    setCueScriptDrafts(toCueScriptDrafts(nextTracks));
                },
            });
            const startTime = getNextDialogueStartTime(tracks);

            await createCue(String(track.id), {
                script,
                startTime,
                endTime: startTime + 1000,
                ...selectedCuePosition,
                volume: 1,
            });
            await refreshTracks();
            setDialogueDraft((current) => ({ ...current, script: '' }));
            setSelectedSpeakerId(String(characterId));
            setSelectedCuePosition(null);
            setMessage('대사를 추가했습니다.');
        } catch {
            setMessage('대사 추가에 실패했습니다.');
        } finally {
            setIsSavingDialogue(false);
        }
    };

    const saveDialogueCue = async (trackId: number, cueId: number) => {
        const script = cueScriptDrafts[cueId]?.trim() ?? '';

        if (!script) {
            setMessage('대사를 입력해 주세요.');
            return;
        }

        try {
            setMessage('');
            await updateCue(String(trackId), String(cueId), { script });
            await refreshTracks();
            setMessage('대사를 저장했습니다.');
        } catch {
            setMessage('대사 저장에 실패했습니다.');
        }
    };

    const deleteDialogueCue = async (trackId: number, cueId: number) => {
        try {
            setMessage('');
            await deleteCue(String(trackId), String(cueId));
            await refreshTracks();
            setMessage('대사를 삭제했습니다.');
        } catch {
            setMessage('대사 삭제에 실패했습니다.');
        }
    };

    return (
        <main className="tp-catalog" data-testid="studio-product-media-dashboard">
            <header className="tp-topbar">
                <Link className="tp-brand" href="/studio/products">
                    <ToonedBrand />
                </Link>
                <div className="tp-crumb">
                    <span>/</span>
                    <Link href="/studio/products">내 작품</Link>
                    <span>/</span>
                    <Link href={`/studio/products/${product.id}/episodes`}>{product.title}</Link>
                    <span>/</span>
                    <strong>
                        {selectedEpisode
                            ? `${selectedEpisode.episodeNumber}화 · ${selectedEpisode.title} · 사전 구성`
                            : '사전 구성'}
                    </strong>
                </div>
                <div className="tp-spacer" />
                <Link className="tp-btn ghost" href={`/studio/products/${product.id}/episodes`}>
                    <StudioCatalogIcon name="chevronLeft" />
                    에피소드로
                </Link>
                <Link className="tp-btn primary" href={editorHref}>
                    타임라인 편집 시작
                    <StudioCatalogIcon name="chevronRight" />
                </Link>
                <div className="tp-avatar">TP</div>
            </header>

            <div className="tp-catalog-body">
                <StudioProductRail active="media" episodeId={selectedEpisodeId} productId={product.id} />
                <section className="tp-catalog-content tp-setup-shell">
                    {episodes.length === 0 ? (
                        <div className="tp-setup-empty">
                            <StudioCatalogIcon name="asset" />
                            <h3>에피소드가 없습니다</h3>
                            <p>미디어는 에피소드 단위 API에 저장됩니다. 먼저 에피소드를 생성해 주세요.</p>
                            <Link className="tp-btn primary" href={`/studio/products/${product.id}/episodes`}>
                                프로젝트 상세로 이동
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="tp-setup-stepper">
                                {setupSteps.map((step, index) => {
                                    const count =
                                        step.id === 'media'
                                            ? String(counts.all)
                                            : step.id === 'canvas'
                                              ? `${canvases.length}캔버스`
                                              : String(dialogueRows.length);
                                    const isCurrent = step.id === activeStep;
                                    const isDone = index < activeStepIndex;

                                    return (
                                        <div className="tp-step-group" key={step.id}>
                                            <button
                                                className={`tp-setup-step ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}
                                                onClick={() => setActiveStep(step.id)}
                                                type="button"
                                            >
                                                <span className="tp-step-num">{index + 1}</span>
                                                <span className="tp-step-text">
                                                    <strong>{step.title}</strong>
                                                    <small>{step.description}</small>
                                                </span>
                                                <span className="tp-step-count">{count}</span>
                                            </button>
                                            {index < setupSteps.length - 1 ? (
                                                <span className="tp-step-arrow">
                                                    <StudioCatalogIcon name="chevronRight" />
                                                </span>
                                            ) : null}
                                        </div>
                                    );
                                })}
                                <div className="tp-spacer" />
                                <label className="tp-setup-episode">
                                    <span>{currentEpisodeLabel}</span>
                                    <select
                                        disabled={isLoadingShell || episodes.length === 0}
                                        onChange={(event) => setSelectedEpisodeId(event.target.value)}
                                        value={selectedEpisodeId}
                                    >
                                        {episodes.map((episode) => (
                                            <option key={episode.id} value={episode.id}>
                                                EP.{episode.episodeNumber} {episode.title}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className={activeStep === 'media' ? 'tp-setup-pane' : 'tp-setup-pane is-workspace'}>
                                {message ? (
                                    <p
                                        className={
                                            message.includes('실패') || message.includes('못했습니다')
                                                ? 'tp-character-message is-error'
                                                : 'tp-character-message'
                                        }
                                    >
                                        {message}
                                    </p>
                                ) : null}
                                <div
                                    className={
                                        activeStep === 'media' ? 'tp-setup-pane-in' : 'tp-setup-pane-in is-workspace'
                                    }
                                >
                                    {activeStep === 'media' ? (
                                        <section className="tp-step-panel">
                                            <div className="tp-pane-head">
                                                <div>
                                                    <span className={`tp-status ${product.status}`}>
                                                        {productStatusLabels[product.status]}
                                                    </span>
                                                    <h1>미디어 등록</h1>
                                                    <p>
                                                        웹툰 컷 이미지, 중간 삽입 영상, 배경음악·효과음을 먼저
                                                        올려두세요.
                                                    </p>
                                                </div>
                                                <div className="tp-seg" role="tablist" aria-label="미디어 유형 필터">
                                                    {(['all', 'image', 'video', 'audio'] as MediaFilter[]).map(
                                                        (type) => (
                                                            <button
                                                                aria-selected={filter === type}
                                                                className={filter === type ? 'on' : ''}
                                                                key={type}
                                                                onClick={() => setFilter(type)}
                                                                role="tab"
                                                                type="button"
                                                            >
                                                                {type === 'image' ? '웹툰 컷' : mediaLabels[type]}
                                                                <span>{counts[type]}</span>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            <label
                                                className={`tp-setup-drop ${isUploading ? 'is-disabled' : ''}`}
                                                onDragOver={(event) => event.preventDefault()}
                                                onDrop={dropMediaFiles}
                                            >
                                                <span className="tp-drop-icon">
                                                    <StudioCatalogIcon name="download" />
                                                </span>
                                                <span className="tp-drop-text">
                                                    <strong>
                                                        {isUploading
                                                            ? '업로드 중'
                                                            : '여기로 파일을 끌어다 놓거나 클릭해서 선택'}
                                                    </strong>
                                                    <small>
                                                        이미지(PNG·JPG·WebP) · 영상(MP4·WebM) · 오디오(MP3·WAV)
                                                    </small>
                                                </span>
                                                <span className="tp-spacer" />
                                                <span className="tp-btn primary">
                                                    <StudioCatalogIcon name="plus" /> 파일 추가
                                                </span>
                                                <input
                                                    accept="image/*,video/*,audio/*"
                                                    disabled={isUploading || !selectedEpisodeId}
                                                    multiple
                                                    onChange={uploadMediaFiles}
                                                    type="file"
                                                />
                                            </label>

                                            <div className="tp-media-grid tp-media-grid-setup">
                                                {visibleMedia.length > 0 ? (
                                                    visibleMedia.map((media) => (
                                                        <article
                                                            className={`tp-media-card ${media.mediaType} ${selectedMediaIds.includes(media.id) ? 'is-selected' : ''}`}
                                                            key={media.id}
                                                            onClick={() => toggleMediaSelection(media.id)}
                                                        >
                                                            <MediaPreview media={media} compact />
                                                            {selectedMediaIds.includes(media.id) ? (
                                                                <span className="tp-media-selected">선택</span>
                                                            ) : null}
                                                            <span className="tp-media-meta">
                                                                <strong>{media.mediaName}</strong>
                                                                <small>
                                                                    {mediaLabels[media.mediaType]} ·{' '}
                                                                    {formatDuration(media.duration)}
                                                                </small>
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
                                    ) : null}

                                    {activeStep === 'canvas' ? (
                                        <section className="tp-step-panel tp-step-panel-fill">
                                            <div className="tp-canvas-workbench">
                                                <aside className="tp-canvas-col tp-canvas-col-list">
                                                    <div className="tp-canvas-colhead">
                                                        <h2>캔버스</h2>
                                                        <span>{canvases.length}</span>
                                                    </div>
                                                    <div className="tp-canvas-list">
                                                        {canvases.length > 0 ? (
                                                            canvases.map((canvas, index) => (
                                                                <button
                                                                    className={
                                                                        canvas.id === selectedCanvasId
                                                                            ? 'tp-canvas-row is-selected'
                                                                            : 'tp-canvas-row'
                                                                    }
                                                                    key={canvas.id}
                                                                    onClick={() => {
                                                                        setSelectedCanvasId(canvas.id);
                                                                        setSelectedCuePosition(null);
                                                                        setSelectedMediaIds(
                                                                            (canvas.medias ?? [])
                                                                                .slice()
                                                                                .sort(
                                                                                    (a, b) =>
                                                                                        (a.index ?? 0) - (b.index ?? 0)
                                                                                )
                                                                                .map((media) => media.mediaId)
                                                                        );
                                                                    }}
                                                                    type="button"
                                                                >
                                                                    <span className="tp-canvas-stack">
                                                                        {(canvas.medias ?? [])
                                                                            .slice(0, 4)
                                                                            .map((media, mediaIndex) => (
                                                                                <i
                                                                                    key={`${media.mediaId}-${mediaIndex}`}
                                                                                />
                                                                            ))}
                                                                    </span>
                                                                    <span>
                                                                        <strong>스트립 {index + 1}</strong>
                                                                        <small>컷 {canvas.medias?.length ?? 0}개</small>
                                                                    </span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="tp-character-empty">
                                                                아직 캔버스가 없습니다.
                                                            </div>
                                                        )}
                                                    </div>
                                                </aside>

                                                <section className="tp-canvas-stage">
                                                    <div className="tp-canvas-stage-head">
                                                        <div>
                                                            <h1>
                                                                {selectedCanvas
                                                                    ? `스트립 ${canvases.findIndex((canvas) => canvas.id === selectedCanvas.id) + 1}`
                                                                    : '스트립'}
                                                            </h1>
                                                            <p>
                                                                {selectedCanvas
                                                                    ? `${selectedCanvas.medias?.length ?? 0}개 미디어 · ID ${selectedCanvas.id}`
                                                                    : '캔버스를 선택하세요'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="tp-strip-stage">
                                                        {canvasDraftItems.length > 0 ? (
                                                            <div className="tp-strip-stack">
                                                                {canvasDraftItems.map((media, index) => (
                                                                    <div
                                                                        className={`tp-strip-block ${media.mediaType}`}
                                                                        key={`${media.id}-${index}`}
                                                                    >
                                                                        <span className="tp-strip-label">
                                                                            {media.mediaType === 'video'
                                                                                ? '영상'
                                                                                : media.mediaType === 'audio'
                                                                                  ? '오디오'
                                                                                  : '컷'}
                                                                        </span>
                                                                        <MediaPreview media={media} compact={false} />
                                                                        <strong>{media.mediaName}</strong>
                                                                        <div className="tp-strip-controls">
                                                                            <button
                                                                                aria-label={`${media.mediaName} 위로 이동`}
                                                                                className="is-up"
                                                                                disabled={index === 0}
                                                                                onClick={() =>
                                                                                    moveCanvasDraftItem(index, -1)
                                                                                }
                                                                                type="button"
                                                                            >
                                                                                <StudioCatalogIcon name="chevronRight" />
                                                                            </button>
                                                                            <button
                                                                                aria-label={`${media.mediaName} 아래로 이동`}
                                                                                className="is-down"
                                                                                disabled={
                                                                                    index ===
                                                                                    canvasDraftItems.length - 1
                                                                                }
                                                                                onClick={() =>
                                                                                    moveCanvasDraftItem(index, 1)
                                                                                }
                                                                                type="button"
                                                                            >
                                                                                <StudioCatalogIcon name="chevronRight" />
                                                                            </button>
                                                                            <button
                                                                                aria-label={`${media.mediaName} 제거`}
                                                                                className="is-danger"
                                                                                onClick={() =>
                                                                                    removeCanvasDraftItem(index)
                                                                                }
                                                                                type="button"
                                                                            >
                                                                                <StudioCatalogIcon name="trash" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="tp-empty compact">
                                                                <StudioCatalogIcon name="image" />
                                                                <p>캔버스에 연결된 미디어가 없습니다.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>

                                                <aside className="tp-canvas-col tp-canvas-col-insp">
                                                    <div className="tp-canvas-colhead">
                                                        <h2>구성</h2>
                                                        <span>{canvasDraftMediaIds.length}선택</span>
                                                    </div>
                                                    <div className="tp-canvas-inspector">
                                                        <button
                                                            className="tp-btn primary"
                                                            disabled={canvasDraftMediaIds.length === 0}
                                                            onClick={createCanvasFromSelection}
                                                            type="button"
                                                        >
                                                            <StudioCatalogIcon name="plus" />새 캔버스
                                                        </button>
                                                        <button
                                                            className="tp-btn ghost"
                                                            disabled={
                                                                !selectedCanvas || canvasDraftMediaIds.length === 0
                                                            }
                                                            onClick={saveSelectedCanvas}
                                                            type="button"
                                                        >
                                                            <StudioCatalogIcon name="check" />
                                                            선택 캔버스 저장
                                                        </button>
                                                        <button
                                                            className="tp-btn ghost"
                                                            disabled={!selectedCanvas}
                                                            onClick={selectCanvasMedia}
                                                            type="button"
                                                        >
                                                            현재 캔버스 불러오기
                                                        </button>
                                                        <div className="tp-canvas-kv">
                                                            <span>전체 미디어</span>
                                                            <strong>{counts.all}</strong>
                                                        </div>
                                                        <div className="tp-canvas-kv">
                                                            <span>선택 미디어</span>
                                                            <strong>{canvasDraftMediaIds.length}</strong>
                                                        </div>
                                                        <div className="tp-canvas-kv">
                                                            <span>캔버스 수</span>
                                                            <strong>{canvases.length}</strong>
                                                        </div>
                                                        <div className="tp-canvas-source-list">
                                                            {mediaItems
                                                                .filter((media) => media.mediaType !== 'audio')
                                                                .map((media) => (
                                                                    <button
                                                                        key={media.id}
                                                                        onClick={() => addCanvasDraftItem(media.id)}
                                                                        type="button"
                                                                    >
                                                                        <MediaPreview media={media} compact />
                                                                        <span>{media.mediaName}</span>
                                                                        <StudioCatalogIcon name="plus" />
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </aside>
                                            </div>
                                        </section>
                                    ) : null}

                                    {activeStep === 'dialogue' ? (
                                        <section className="tp-step-panel tp-step-panel-fill">
                                            <div className="tp-dialogue-workspace" style={dialogueWorkspaceStyle}>
                                                <aside className="tp-dialogue-strip-panel" ref={dialogueStripRef}>
                                                    <div className="tp-canvas-colhead">
                                                        <div>
                                                            <h2>스트립</h2>
                                                            <p>
                                                                {selectedCanvas
                                                                    ? `캔버스 ID ${selectedCanvas.id}`
                                                                    : '캔버스 없음'}
                                                            </p>
                                                        </div>
                                                        <span>{selectedCanvasMediaItems.length}</span>
                                                    </div>
                                                    <div className="tp-dialogue-strip-controls">
                                                        <label>
                                                            <span>크기</span>
                                                            <input
                                                                aria-label="스트립 크기"
                                                                max={200}
                                                                min={70}
                                                                onChange={(event) =>
                                                                    updateDialogueStripScale(event.currentTarget.value)
                                                                }
                                                                step={5}
                                                                type="range"
                                                                value={dialogueStripSize.scale}
                                                            />
                                                            <input
                                                                aria-label="스트립 크기 숫자"
                                                                max={200}
                                                                min={70}
                                                                onChange={(event) =>
                                                                    updateDialogueStripScale(event.currentTarget.value)
                                                                }
                                                                step={5}
                                                                type="number"
                                                                value={dialogueStripSize.scale}
                                                            />
                                                        </label>
                                                        <small>폭 {dialogueStripSize.width}px · 원본 비율</small>
                                                    </div>
                                                    <div className="tp-dialogue-strip-stage">
                                                        {selectedCanvasMediaItems.length > 0 ? (
                                                            <div
                                                                className="tp-dialogue-strip-stack"
                                                                data-dialogue-strip-stack
                                                            >
                                                                {selectedCanvasMediaItems.map((media, index) => {
                                                                    const visualId = toDialogueVisualId(media);
                                                                    const isSelectedPosition =
                                                                        selectedCuePosition?.startCanvasMediaId ===
                                                                        media.canvasMediaId;
                                                                    const selectedPositionPercent = isSelectedPosition
                                                                        ? selectedCuePosition?.startPosition
                                                                        : undefined;
                                                                    const mediaCueRows = visibleDialogueRows.filter(
                                                                        ({ cue }) =>
                                                                            cue.startCanvasMediaId ===
                                                                            media.canvasMediaId
                                                                    );
                                                                    const visibleMediaCueRows = mediaCueRows.slice(0, 6);
                                                                    const hiddenMediaCueCount =
                                                                        mediaCueRows.length - visibleMediaCueRows.length;

                                                                    return (
                                                                        <button
                                                                            className={
                                                                                isSelectedPosition
                                                                                    ? `tp-dialogue-strip-block ${media.mediaType} is-selected`
                                                                                    : `tp-dialogue-strip-block ${media.mediaType}`
                                                                            }
                                                                            data-dialogue-index={media.index ?? index}
                                                                            data-dialogue-visual-id={visualId}
                                                                            key={`${media.canvasMediaId ?? media.mediaId}-${index}`}
                                                                            onClick={selectDialogueCuePosition}
                                                                            type="button"
                                                                        >
                                                                            <span className="tp-dialogue-strip-label">
                                                                                {media.mediaType === 'video'
                                                                                    ? '영상'
                                                                                    : '컷'}
                                                                            </span>
                                                                            <MediaPreview
                                                                                media={toMediaListItem(
                                                                                    media,
                                                                                    selectedCanvas?.episodeId ??
                                                                                        Number(selectedEpisodeId)
                                                                                )}
                                                                                compact={false}
                                                                            />
                                                                            <strong>{media.mediaName}</strong>
                                                                            {typeof selectedPositionPercent ===
                                                                            'number' ? (
                                                                                <i
                                                                                    className="tp-dialogue-position-marker is-draft"
                                                                                    style={{
                                                                                        top: `${selectedPositionPercent}%`,
                                                                                    }}
                                                                                />
                                                                            ) : null}
                                                                            {visibleMediaCueRows.map(({ cue, character, track }) => {
                                                                                const speakerName =
                                                                                    character?.name ?? track.name;

                                                                                return (
                                                                                    <span
                                                                                        className="tp-dialogue-strip-cue"
                                                                                        key={cue.id}
                                                                                        style={{
                                                                                            '--tp-dialogue-cue-top': `${toDialogueCueOverlayTop(cue.startPosition)}%`,
                                                                                        } as CSSProperties}
                                                                                        title={`${speakerName}: ${cue.script}`}
                                                                                    >
                                                                                        <i>
                                                                                            {getCharacterInitial(
                                                                                                speakerName
                                                                                            )}
                                                                                        </i>
                                                                                        <span>
                                                                                            <b>{speakerName}</b>
                                                                                            <em>{cue.script}</em>
                                                                                        </span>
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                            {hiddenMediaCueCount > 0 ? (
                                                                                <span className="tp-dialogue-strip-more">
                                                                                    +{hiddenMediaCueCount}
                                                                                </span>
                                                                            ) : null}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="tp-character-empty">
                                                                저장된 캔버스 컷이 없습니다.
                                                            </div>
                                                        )}
                                                    </div>
                                                </aside>

                                                <aside className="tp-dialogue-speakers">
                                                    <div className="tp-canvas-colhead">
                                                        <h2>화자</h2>
                                                        <span>{characters.length}</span>
                                                    </div>
                                                    <div className="tp-dialogue-speaker-list">
                                                        <button
                                                            className={
                                                                selectedSpeakerId === 'all'
                                                                    ? 'tp-dialogue-speaker is-selected'
                                                                    : 'tp-dialogue-speaker'
                                                            }
                                                            onClick={() => setSelectedSpeakerId('all')}
                                                            type="button"
                                                        >
                                                            <span className="tp-dialogue-dot all" />
                                                            <strong>전체 대사</strong>
                                                            <small>{dialogueRows.length}</small>
                                                        </button>
                                                        {characters.map((character) => (
                                                            <button
                                                                className={
                                                                    selectedSpeakerId === String(character.id)
                                                                        ? 'tp-dialogue-speaker is-selected'
                                                                        : 'tp-dialogue-speaker'
                                                                }
                                                                key={character.id}
                                                                onClick={() => {
                                                                    setSelectedSpeakerId(String(character.id));
                                                                    setDialogueDraft((current) => ({
                                                                        ...current,
                                                                        characterId: String(character.id),
                                                                    }));
                                                                }}
                                                                type="button"
                                                            >
                                                                <span className="tp-dialogue-dot">
                                                                    {getCharacterInitial(character.name)}
                                                                </span>
                                                                <strong>{character.name}</strong>
                                                                <small>
                                                                    {getDialogueCountForCharacter(
                                                                        dialogueRows,
                                                                        character.id
                                                                    )}
                                                                </small>
                                                            </button>
                                                        ))}
                                                        <div className="tp-dialogue-character-add">
                                                            <span>빠른 캐릭터 추가</span>
                                                            <div className="tp-dialogue-character-add-row">
                                                                <input
                                                                    aria-label="빠른 캐릭터 이름"
                                                                    disabled={
                                                                        isCreatingDialogueCharacter || isSavingDialogue
                                                                    }
                                                                    onChange={(event) =>
                                                                        setQuickCharacterName(event.currentTarget.value)
                                                                    }
                                                                    onKeyDown={createQuickDialogueCharacterOnEnter}
                                                                    placeholder="예: 학생 A"
                                                                    value={quickCharacterName}
                                                                />
                                                                <select
                                                                    aria-label="빠른 캐릭터 역할"
                                                                    disabled={
                                                                        isCreatingDialogueCharacter || isSavingDialogue
                                                                    }
                                                                    onChange={(event) =>
                                                                        setQuickCharacterRole(
                                                                            event.currentTarget.value as CharacterRole
                                                                        )
                                                                    }
                                                                    value={quickCharacterRole}
                                                                >
                                                                    {characterRoleOptions.map((role) => (
                                                                        <option key={role} value={role}>
                                                                            {characterRoleLabels[role]}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <button
                                                                    className="tp-btn ghost"
                                                                    disabled={
                                                                        isCreatingDialogueCharacter ||
                                                                        isSavingDialogue ||
                                                                        !quickCharacterName.trim()
                                                                    }
                                                                    onClick={() => void createQuickDialogueCharacter()}
                                                                    type="button"
                                                                >
                                                                    <StudioCatalogIcon name="plus" />
                                                                    {isCreatingDialogueCharacter ? '추가 중' : '캐릭터 추가'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {characters.length === 0 ? (
                                                            <div className="tp-character-empty">
                                                                캐릭터를 먼저 등록해 주세요.
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </aside>

                                                <section className="tp-dialogue-main">
                                                    <div className="tp-canvas-colhead">
                                                        <div>
                                                            <h2>{selectedSpeakerName}</h2>
                                                            <p>
                                                                {isLoadingEpisodeData
                                                                    ? '불러오는 중'
                                                                    : `${visibleDialogueRows.length}개 대사`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <form className="tp-dialogue-create" onSubmit={createDialogueCue}>
                                                        <label>
                                                            <span>화자</span>
                                                            <select
                                                                disabled={
                                                                    characters.length === 0 ||
                                                                    isSavingDialogue ||
                                                                    isCreatingDialogueCharacter
                                                                }
                                                                onChange={(event) => {
                                                                    const characterId = event.currentTarget.value;
                                                                    setDialogueDraft((current) => ({
                                                                        ...current,
                                                                        characterId,
                                                                    }));
                                                                }}
                                                                value={dialogueDraft.characterId}
                                                            >
                                                                {characters.map((character) => (
                                                                    <option key={character.id} value={character.id}>
                                                                        {character.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                        <div className="tp-dialogue-position-field">
                                                            <span>삽입 위치</span>
                                                            <span className="tp-dialogue-position-inputs">
                                                                <select
                                                                    aria-label="대사 삽입 컷"
                                                                    disabled={
                                                                        selectedCanvasMediaItems.length === 0 ||
                                                                        isSavingDialogue
                                                                    }
                                                                    onChange={(event) =>
                                                                        selectManualDialogueCueMedia(
                                                                            event.currentTarget.value
                                                                        )
                                                                    }
                                                                    value={selectedCuePositionCanvasMediaId}
                                                                >
                                                                    {typeof firstSelectableCanvasMediaId !==
                                                                    'number' ? (
                                                                        <option value="">컷 없음</option>
                                                                    ) : null}
                                                                    {selectedCanvasMediaItems
                                                                        .filter(
                                                                            (media) =>
                                                                                typeof media.canvasMediaId === 'number'
                                                                        )
                                                                        .map((media, index) => (
                                                                            <option
                                                                                key={media.canvasMediaId}
                                                                                value={media.canvasMediaId}
                                                                            >
                                                                                {index + 1}. {media.mediaName}
                                                                            </option>
                                                                        ))}
                                                                </select>
                                                                <input
                                                                    aria-label="대사 삽입 위치값"
                                                                    disabled={
                                                                        selectedCanvasMediaItems.length === 0 ||
                                                                        isSavingDialogue
                                                                    }
                                                                    max={100}
                                                                    min={0}
                                                                    onChange={(event) =>
                                                                        updateManualDialogueCuePosition(
                                                                            event.currentTarget.value
                                                                        )
                                                                    }
                                                                    placeholder="%"
                                                                    step={1}
                                                                    type="number"
                                                                    value={selectedCuePosition?.startPosition ?? ''}
                                                                />
                                                            </span>
                                                            <small>{selectedCuePositionLabel}</small>
                                                        </div>
                                                        <label className="tp-dialogue-script-field">
                                                            <span>대사</span>
                                                            <textarea
                                                                disabled={
                                                                    characters.length === 0 ||
                                                                    isSavingDialogue ||
                                                                    isCreatingDialogueCharacter
                                                                }
                                                                onChange={(event) => {
                                                                    const script = event.currentTarget.value;
                                                                    setDialogueDraft((current) => ({
                                                                        ...current,
                                                                        script,
                                                                    }));
                                                                }}
                                                                placeholder="대사를 입력하세요..."
                                                                value={dialogueDraft.script}
                                                            />
                                                        </label>
                                                        <button
                                                            className="tp-btn primary"
                                                            disabled={
                                                                characters.length === 0 ||
                                                                isSavingDialogue ||
                                                                isCreatingDialogueCharacter ||
                                                                !dialogueDraft.script.trim() ||
                                                                !selectedCuePosition
                                                            }
                                                            type="submit"
                                                        >
                                                            <StudioCatalogIcon name="plus" />
                                                            {isSavingDialogue ? '추가 중' : '대사 추가'}
                                                        </button>
                                                    </form>
                                                    <div className="tp-dialogue-list">
                                                        {visibleDialogueRows.length > 0 ? (
                                                            visibleDialogueRows.map(
                                                                ({ cue, track, character }, index) => (
                                                                    <article className="tp-dialogue-row" key={cue.id}>
                                                                        <span className="tp-dialogue-grip">
                                                                            {String(index + 1).padStart(2, '0')}
                                                                        </span>
                                                                        <div className="tp-dialogue-row-body">
                                                                            <div className="tp-dialogue-row-head">
                                                                                <span>
                                                                                    <i>
                                                                                        {getCharacterInitial(
                                                                                            character?.name ??
                                                                                                track.name
                                                                                        )}
                                                                                    </i>
                                                                                    {character?.name ?? track.name}
                                                                                </span>
                                                                                <small>
                                                                                    {formatMilliseconds(cue.startTime)}{' '}
                                                                                    · {track.name}
                                                                                </small>
                                                                            </div>
                                                                            <textarea
                                                                                onChange={(event) => {
                                                                                    const script =
                                                                                        event.currentTarget.value;
                                                                                    setCueScriptDrafts((current) => ({
                                                                                        ...current,
                                                                                        [cue.id]: script,
                                                                                    }));
                                                                                }}
                                                                                value={
                                                                                    cueScriptDrafts[cue.id] ??
                                                                                    cue.script
                                                                                }
                                                                            />
                                                                        </div>
                                                                        <div className="tp-dialogue-row-actions">
                                                                            <button
                                                                                className="tp-btn mini"
                                                                                disabled={
                                                                                    (
                                                                                        cueScriptDrafts[cue.id] ??
                                                                                        cue.script
                                                                                    ).trim() === cue.script
                                                                                }
                                                                                onClick={() =>
                                                                                    void saveDialogueCue(
                                                                                        track.id,
                                                                                        cue.id
                                                                                    )
                                                                                }
                                                                                type="button"
                                                                            >
                                                                                저장
                                                                            </button>
                                                                            <button
                                                                                aria-label="대사 삭제"
                                                                                className="tp-card-icon danger"
                                                                                onClick={() =>
                                                                                    void deleteDialogueCue(
                                                                                        track.id,
                                                                                        cue.id
                                                                                    )
                                                                                }
                                                                                type="button"
                                                                            >
                                                                                <StudioCatalogIcon name="trash" />
                                                                            </button>
                                                                        </div>
                                                                    </article>
                                                                )
                                                            )
                                                        ) : (
                                                            <div className="tp-empty compact">
                                                                <StudioCatalogIcon name="mic" />
                                                                <p>등록된 대사가 없습니다.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>
                                            </div>
                                        </section>
                                    ) : null}
                                </div>
                            </div>

                            <footer className="tp-setup-footnav">
                                <span>
                                    {activeStepIndex + 1} / {setupSteps.length} 단계
                                </span>
                                <span className="tp-setup-progress">
                                    <i style={{ width: progressWidth }} />
                                </span>
                                <div className="tp-spacer" />
                                <button
                                    className="tp-btn ghost"
                                    disabled={activeStepIndex === 0}
                                    onClick={() => setActiveStep(setupSteps[Math.max(0, activeStepIndex - 1)].id)}
                                    type="button"
                                >
                                    이전
                                </button>
                                {activeStepIndex < setupSteps.length - 1 ? (
                                    <button
                                        className="tp-btn primary"
                                        onClick={() =>
                                            setActiveStep(
                                                setupSteps[Math.min(setupSteps.length - 1, activeStepIndex + 1)].id
                                            )
                                        }
                                        type="button"
                                    >
                                        다음
                                        <StudioCatalogIcon name="chevronRight" />
                                    </button>
                                ) : (
                                    <Link className="tp-btn primary" href={editorHref}>
                                        타임라인으로
                                        <StudioCatalogIcon name="chevronRight" />
                                    </Link>
                                )}
                            </footer>
                        </>
                    )}
                </section>
            </div>
        </main>
    );
}

function MediaPreview({
    compact,
    media,
}: {
    compact: boolean;
    media: Pick<MediaListItem, 'mediaName' | 'mediaType' | 'mediaUrl'>;
}) {
    return (
        <span className={`tp-media-thumb ${compact ? 'compact' : ''} ${media.mediaType}`}>
            {media.mediaType === 'image' ? <img alt="" src={media.mediaUrl} /> : null}
            {media.mediaType === 'video' ? (
                <>
                    <video muted playsInline preload="metadata" src={media.mediaUrl} />
                    <i>
                        <StudioCatalogIcon name="play" />
                    </i>
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

function StudioProductRail({
    active,
    episodeId,
    productId,
}: {
    active: 'artists' | 'media' | 'products';
    episodeId?: string;
    productId: string;
}) {
    const editorHref = episodeId
        ? `/studio/products/${productId}/episodes/${episodeId}`
        : `/studio/products/${productId}/episodes`;

    return (
        <nav className="tp-rail" aria-label="studio product">
            <Link className={active === 'products' ? 'active' : ''} href={`/studio/products/${productId}/episodes`}>
                <StudioCatalogIcon name="panel" />
                <span>작품</span>
            </Link>
            <Link className={active === 'media' ? 'active' : ''} href={`/studio/products/${productId}/media`}>
                <StudioCatalogIcon name="image" />
                <span>구성</span>
            </Link>
            <Link className={active === 'artists' ? 'active' : ''} href={`/studio/products/${productId}/artists`}>
                <StudioCatalogIcon name="mic" />
                <span>성우</span>
            </Link>
            <Link href={editorHref}>
                <StudioCatalogIcon name="play" />
                <span>편집기</span>
            </Link>
            <span className="tp-rail-spacer" />
            <Link href={`/studio/products/${productId}/episodes`}>
                <StudioCatalogIcon name="settings" />
                <span>설정</span>
            </Link>
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
    const extension =
        file.name
            .split('.')
            .filter(Boolean)
            .pop()
            ?.replace(/[^a-z0-9]/gi, '')
            .toLowerCase() || 'bin';

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

function isDialogueTrack(track: TrackListItem) {
    return track.type === 'record' && typeof track.characterId === 'number';
}

function toCueScriptDrafts(tracks: TrackListItem[]) {
    const drafts: Record<number, string> = {};

    tracks.forEach((track) => {
        (track.cues ?? []).forEach((cue) => {
            drafts[cue.id] = cue.script;
        });
    });

    return drafts;
}

function getDialogueCountForCharacter(
    rows: Array<{ character?: CharacterListItem; track: TrackListItem; cue: TrackCueListItem }>,
    characterId: number
) {
    return rows.filter((row) => row.character?.id === characterId || row.track.characterId === characterId).length;
}

function getCharacterInitial(name: string) {
    return name.trim().slice(0, 1).toUpperCase() || '화';
}

function formatMilliseconds(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0:00';

    const seconds = Math.round(milliseconds / 1000);
    const minute = Math.floor(seconds / 60);
    const second = String(seconds % 60).padStart(2, '0');

    return `${minute}:${second}`;
}

function getNextDialogueStartTime(tracks: TrackListItem[]) {
    const latestEndTime = tracks
        .filter(isDialogueTrack)
        .flatMap((track) => track.cues ?? [])
        .reduce((latest, cue) => Math.max(latest, cue.endTime), 0);

    return latestEndTime + 1000;
}

async function ensureDialogueTrack({
    characterId,
    characters,
    episodeId,
    tracks,
    onTracks,
}: {
    characterId: number;
    characters: CharacterListItem[];
    episodeId: string;
    tracks: TrackListItem[];
    onTracks: (tracks: TrackListItem[]) => void;
}) {
    const existingTrack = tracks.find((track) => track.type === 'record' && track.characterId === characterId);

    if (existingTrack) return existingTrack;

    const character = characters.find((item) => item.id === characterId);
    await createTrack(episodeId, {
        name: `${character?.name ?? `캐릭터 ${characterId}`} 보이스`,
        type: 'record',
        characterId,
        isMuted: false,
    });

    const listedTracks = await listTracks(episodeId);
    onTracks(listedTracks);

    const createdTrack = listedTracks.find((track) => track.type === 'record' && track.characterId === characterId);

    if (!createdTrack) {
        throw new Error('Dialogue track was not created');
    }

    return createdTrack;
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
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/episodes`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Episode list failed: ${response.status}`);
    }

    const result = (await response.json()) as EpisodeListResponse;
    return result.data.items;
}

async function listCharacters(productId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/characters`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Character list failed: ${response.status}`);
    }

    const result = (await response.json()) as CharacterListResponse;
    return result.data.items;
}

async function createCharacter(productId: string, character: CharacterCreateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/products/${productId}/characters`, {
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

async function listMedia(episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/medias`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Media list failed: ${response.status}`);
    }

    const result = (await response.json()) as MediaListResponse;
    return result.data.items;
}

async function listTracks(episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/tracks`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Track list failed: ${response.status}`);
    }

    const result = (await response.json()) as TrackListResponse;
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

async function createTrack(episodeId: string, track: TrackCreateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/tracks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(track),
    });

    if (!response.ok) {
        throw new Error(`Track create failed: ${response.status}`);
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

async function createCue(trackId: string, cue: CueCreateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cue),
    });

    if (!response.ok) {
        throw new Error(`Cue create failed: ${response.status}`);
    }
}

async function updateCue(trackId: string, cueId: string, cue: CueUpdateRequest) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues/${cueId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cue),
    });

    if (!response.ok) {
        throw new Error(`Cue update failed: ${response.status}`);
    }
}

async function deleteCue(trackId: string, cueId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/tracks/${trackId}/cues/${cueId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Cue delete failed: ${response.status}`);
    }
}

async function listCanvases(episodeId: string) {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/episodes/${episodeId}/canvases`, {
        cache: 'no-store',
    });

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
