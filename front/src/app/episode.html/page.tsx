import { StudioEpisodeDashboard } from '../_lib/studioCatalog/StudioEpisodeDashboard';

export default async function EpisodeHtmlPage({
    searchParams,
}: {
    searchParams: Promise<{ id?: string; productId?: string }>;
}) {
    const { id, productId } = await searchParams;

    return <StudioEpisodeDashboard productId={productId ?? id} />;
}
