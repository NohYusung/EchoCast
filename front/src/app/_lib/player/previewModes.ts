export type PreviewMode = 'preview' | 'cutEdit';

export type PreviewModeDefinition = {
    id: PreviewMode;
    label: string;
};

export const previewModeDefinitions: PreviewModeDefinition[] = [
    {
        id: 'preview',
        label: '미리보기',
    },
    {
        id: 'cutEdit',
        label: '컷 편집',
    },
];
