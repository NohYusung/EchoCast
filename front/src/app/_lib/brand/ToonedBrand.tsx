type ToonedBrandProps = {
    context?: 'catalog' | 'studio';
};

export function ToonedBrand({ context = 'catalog' }: ToonedBrandProps) {
    const markClassName = context === 'studio' ? 'odx-brand-mark' : 'tp-brand-mark';

    return (
        <>
            <span className={markClassName} aria-hidden="true">
                <img
                    src="/brand/tooned-player-mark.svg"
                    alt=""
                    width={context === 'studio' ? 24 : 26}
                    height={context === 'studio' ? 24 : 26}
                />
            </span>
            <span>Tooned</span>
            {context === 'studio' ? <b>Studio</b> : null}
        </>
    );
}
