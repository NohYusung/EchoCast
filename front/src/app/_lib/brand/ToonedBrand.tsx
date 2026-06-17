type ToonedBrandProps = {
    context?: 'catalog' | 'studio';
};

const headerLogoPath = '/brand/assets/dobedub-header-logo-reversed.svg';

export function ToonedBrand({ context = 'catalog' }: ToonedBrandProps) {
    const markClassName = context === 'studio' ? 'odx-brand-mark' : 'tp-brand-mark';

    return (
        <>
            <span className={markClassName}>
                <img alt="DobeDub" src={headerLogoPath} />
            </span>
            {context === 'studio' ? <b>Studio</b> : null}
        </>
    );
}
