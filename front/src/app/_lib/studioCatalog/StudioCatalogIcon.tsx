import type { ReactNode } from 'react';

export type StudioCatalogIconName =
    | 'asset'
    | 'chart'
    | 'check'
    | 'chevronLeft'
    | 'chevronRight'
    | 'close'
    | 'download'
    | 'image'
    | 'mic'
    | 'more'
    | 'panel'
    | 'play'
    | 'plus'
    | 'search'
    | 'settings'
    | 'trash'
    | 'users';

const iconPaths: Record<StudioCatalogIconName, ReactNode> = {
    asset: (
        <>
            <path d="M4 5h16M4 12h10M4 19h16" />
            <circle cx="19" cy="12" r="2.4" />
        </>
    ),
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    check: <path d="M5 12l4 4L19 7" />,
    chevronLeft: <path d="M15 18l-6-6 6-6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    download: <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
    image: (
        <>
            <rect height="18" rx="2" width="18" x="3" y="3" />
            <path d="m3 15 5-5 4 4 3-3 6 6" />
            <circle cx="8.5" cy="8.5" r="1.5" />
        </>
    ),
    mic: (
        <>
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
        </>
    ),
    more: (
        <>
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
        </>
    ),
    panel: (
        <>
            <rect height="18" rx="2.5" width="18" x="3" y="3" />
            <path d="M3 9h18M9 9v12" />
        </>
    ),
    play: <path d="M8 5v14l11-7-11-7Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
        </>
    ),
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1.4l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.4-1.4l-.3-2.6H9.2l-.3 2.6a7 7 0 0 0-2.4 1.4l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.4 1.4l.3 2.6h2.6l.3-2.6a7 7 0 0 0 2.4-1.4l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12Z" />
        </>
    ),
    trash: <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />,
    users: (
        <>
            <circle cx="9" cy="8" r="3.4" />
            <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5M16 4.5a3.4 3.4 0 0 1 0 7M21 20c0-2.8-1.8-4.4-4-4.8" />
        </>
    ),
};

export function StudioCatalogIcon({ name }: { name: StudioCatalogIconName }) {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
        >
            {iconPaths[name]}
        </svg>
    );
}
