export type DobeDubBrandAssetCategory = 'logo' | 'header' | 'symbol' | 'icon' | 'social' | 'application';

export type DobeDubBrandAsset = {
    id: string;
    label: string;
    category: DobeDubBrandAssetCategory;
    path: string;
    format: 'svg';
};

const assetBasePath = '/brand/assets';

export const dobedubBrandAssets = [
    {
        id: 'logo-primary',
        label: 'Primary logo on light',
        category: 'logo',
        path: `${assetBasePath}/dobedub-logo-primary.svg`,
        format: 'svg',
    },
    {
        id: 'logo-reversed',
        label: 'Reversed logo on ink',
        category: 'logo',
        path: `${assetBasePath}/dobedub-logo-reversed.svg`,
        format: 'svg',
    },
    {
        id: 'logo-stacked',
        label: 'Stacked logo with Korean descriptor',
        category: 'logo',
        path: `${assetBasePath}/dobedub-logo-stacked.svg`,
        format: 'svg',
    },
    {
        id: 'logo-on-red',
        label: 'Logo for red background',
        category: 'logo',
        path: `${assetBasePath}/dobedub-logo-onred.svg`,
        format: 'svg',
    },
    {
        id: 'header-logo',
        label: 'Header logo on light',
        category: 'header',
        path: `${assetBasePath}/dobedub-header-logo.svg`,
        format: 'svg',
    },
    {
        id: 'header-logo-reversed',
        label: 'Header logo on ink',
        category: 'header',
        path: `${assetBasePath}/dobedub-header-logo-reversed.svg`,
        format: 'svg',
    },
    {
        id: 'symbol',
        label: 'Voice wave symbol',
        category: 'symbol',
        path: `${assetBasePath}/dobedub-symbol.svg`,
        format: 'svg',
    },
    {
        id: 'avatar-circle',
        label: 'Circle avatar mark',
        category: 'symbol',
        path: `${assetBasePath}/dobedub-avatar-circle.svg`,
        format: 'svg',
    },
    {
        id: 'avatar-squircle',
        label: 'Dark squircle avatar mark',
        category: 'symbol',
        path: `${assetBasePath}/dobedub-avatar-squircle.svg`,
        format: 'svg',
    },
    {
        id: 'app-icon-1024',
        label: 'App icon master',
        category: 'icon',
        path: `${assetBasePath}/dobedub-appicon-1024.svg`,
        format: 'svg',
    },
    {
        id: 'og-wave',
        label: 'Open graph decorative wave',
        category: 'social',
        path: `${assetBasePath}/dobedub-og-wave.svg`,
        format: 'svg',
    },
    {
        id: 'watermark-wave',
        label: 'Watermark badge wave',
        category: 'application',
        path: `${assetBasePath}/dobedub-watermark-wave.svg`,
        format: 'svg',
    },
    {
        id: 'signature-avatar',
        label: 'Signature avatar mark',
        category: 'application',
        path: `${assetBasePath}/dobedub-signature-avatar.svg`,
        format: 'svg',
    },
] as const satisfies readonly DobeDubBrandAsset[];

export const dobedubBrandColors = {
    ink: '#0C0C0D',
    paper: '#FFFFFF',
    dubRed: '#ED1C24',
    redDeep: '#C40F16',
    muted: '#74747A',
    line: '#E9E9EC',
} as const;
