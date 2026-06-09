import { StudioEpisodeDashboard } from '../../../../_lib/studioCatalog/StudioEpisodeDashboard';

export default async function StudioProductEpisodesPage({
    params,
}: {
    params: Promise<{ productId: string }>;
}) {
    const { productId } = await params;

    return <StudioEpisodeDashboard productId={productId} />;
}
