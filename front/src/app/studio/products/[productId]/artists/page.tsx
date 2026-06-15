import { StudioArtistDashboard } from '../../../../_lib/studioCatalog/StudioArtistDashboard';

export default async function StudioProductArtistsPage({
    params,
}: {
    params: Promise<{ productId: string }>;
}) {
    const { productId } = await params;

    return <StudioArtistDashboard productId={productId} />;
}
