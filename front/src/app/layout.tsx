import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
    title: 'DobeDub',
    description: 'DobeDub player studio',
    icons: {
        icon: '/brand/tooned-player-mark.svg',
        apple: '/brand/tooned-player-app-icon.svg',
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
