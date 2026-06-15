import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
    title: 'Tooned Player',
    description: 'Tooned Player test studio',
    icons: {
        icon: '/brand/tooned-player-mark.svg',
        apple: '/brand/tooned-player-app-icon.png',
    },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    );
}
