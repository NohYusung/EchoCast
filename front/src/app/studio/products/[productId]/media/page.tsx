import { StudioProductMediaDashboard } from '../../../../_lib/studioCatalog/StudioProductMediaDashboard';

export default async function StudioProductMediaPage({
    params,
}: {
    params: Promise<{ productId: string }>;
}) {
    const { productId } = await params;

    return <StudioProductMediaDashboard productId={productId} />;
}
