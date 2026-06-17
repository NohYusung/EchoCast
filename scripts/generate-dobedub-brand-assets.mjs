import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('front/public/brand/assets');
const namespace = 'http://www.w3.org/2000/svg';
const redHeights = [6, 14, 22, 10, 4, 18, 8, 20];
const inkHeights = [6, 16, 10, 22, 4, 12, 18, 8, 14, 6, 20, 10, 4, 16, 8, 14, 6, 12];

fs.mkdirSync(outputDir, { recursive: true });

function escapeAttribute(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function attrs(values) {
    return Object.entries(values)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
        .join('');
}

function rect(values) {
    return `<rect${attrs(values)}/>`;
}

function pathElement(values) {
    return `<path${attrs(values)}/>`;
}

function text(values, body) {
    return `<text${attrs(values)}>${body}</text>`;
}

function tspan(values, body) {
    return `<tspan${attrs(values)}>${body}</tspan>`;
}

function svg(viewBox, width, height, body) {
    return `<svg xmlns="${namespace}" viewBox="${viewBox}" width="${width}" height="${height}">${body}</svg>`;
}

function xml(body) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
}

function waveRects(ink, red, yTop = 0) {
    let x = 0;
    let body = '';
    const band = 26;
    const step = 12;
    const width = 5;

    for (const height of redHeights) {
        body += rect({ x, y: yTop + (band - height) / 2, width, height, rx: 2, fill: red });
        x += step;
    }

    for (const height of inkHeights) {
        body += rect({ x, y: yTop + (band - height) / 2, width, height, rx: 2, fill: ink });
        x += step;
    }

    return body;
}

function lockup({ ink, red, kor = false, korFill = '#74747a', width = 300 }) {
    const viewWidth = 360;
    const fontY = kor ? 64 : 48;
    const waveTop = kor ? 80 : 64;
    const viewHeight = waveTop + 30;
    let body = '';

    if (kor) {
        body += text(
            {
                x: viewWidth / 2,
                y: 26,
                'text-anchor': 'middle',
                'font-family': '"SF Mono",ui-monospace,Menlo,monospace',
                'font-size': 11,
                'letter-spacing': 5,
                fill: korFill,
            },
            '보이스뱅크 두비덥'
        );
    }

    body += text(
        {
            x: viewWidth / 2,
            y: fontY,
            'text-anchor': 'middle',
            'font-family': '"Arial Black","Helvetica Neue",Impact,sans-serif',
            'font-weight': 900,
            'font-size': 46,
            'letter-spacing': -1,
        },
        tspan({ fill: ink }, 'DOBE') + tspan({ fill: red }, 'DUB')
    );
    body += `<g transform="translate(${(viewWidth - 324) / 2},0)">${waveRects(ink, red, waveTop)}</g>`;

    return svg(`0 0 ${viewWidth} ${viewHeight}`, width, width * viewHeight / viewWidth, body);
}

function headerLockup({ ink = '#0c0c0d', red = '#ed1c24', height = 44 }) {
    const viewWidth = 196;
    const viewHeight = 40;
    let body = '';

    [12, 20, 30, 20, 12].forEach((barHeight, index) => {
        body += rect({
            x: [2, 8, 14, 20, 26][index],
            y: (viewHeight - barHeight) / 2,
            width: 4,
            height: barHeight,
            rx: 2,
            fill: index === 2 ? red : ink,
        });
    });

    body += text(
        {
            x: 40,
            y: 29,
            'font-family': '"Arial Black","Helvetica Neue",Impact,sans-serif',
            'font-weight': 900,
            'font-size': 26,
            'letter-spacing': -1,
        },
        tspan({ fill: ink }, 'DOBE') + tspan({ fill: red }, 'DUB')
    );

    return svg(`0 0 ${viewWidth} ${viewHeight}`, height * viewWidth / viewHeight, height, body);
}

function symbolInner({ ink = '#0c0c0d', red = '#ed1c24' } = {}) {
    let body = '';

    [20, 34, 52, 34, 20].forEach((height, index) => {
        body += rect({
            x: [8, 19, 30, 41, 52][index],
            y: (64 - height) / 2,
            width: 6,
            height,
            rx: 3,
            fill: index === 2 ? red : ink,
        });
    });

    return body;
}

function symbol({ size = 104 } = {}) {
    return svg('0 0 64 64', size, size, symbolInner());
}

function squirclePath() {
    return 'M32 2 C12 2 2 12 2 32 C2 52 12 62 32 62 C52 62 62 52 62 32 C62 12 52 2 32 2 Z';
}

function circleAvatar() {
    const circle = '<circle cx="32" cy="32" r="31" fill="#fff" stroke="#0c0c0d" stroke-width="2"/>';
    return svg('0 0 64 64', 108, 108, circle + symbolInner());
}

function squircleAvatar() {
    return svg('0 0 64 64', 108, 108, pathElement({ d: squirclePath(), fill: '#0c0c0d' }) + symbolInner({ ink: '#ffffff' }));
}

function appIcon(size) {
    const isSmall = size <= 20;
    const heights = isSmall ? [26, 46, 26] : [16, 28, 44, 28, 16];
    const xs = isSmall ? [24, 30.5, 37] : [14, 23, 32, 41, 50];
    const width = isSmall ? 5 : 6;
    const redIndex = isSmall ? 2 : 3;
    let body = pathElement({ d: squirclePath(), fill: '#0c0c0d' });

    heights.forEach((height, index) => {
        body += rect({
            x: xs[index],
            y: (64 - height) / 2,
            width,
            height,
            rx: width / 2,
            fill: index === redIndex ? '#ed1c24' : '#ffffff',
        });
    });

    return svg('0 0 64 64', size, size, body);
}

function ogWave() {
    let x = 10;
    let body = '';

    [40, 90, 150, 70, 110, 180, 60, 130, 90, 40, 160, 80, 50, 120].forEach((height, index) => {
        body += rect({
            x,
            y: 200 - height,
            width: 14,
            height,
            rx: 6,
            fill: index >= 4 && index <= 6 ? '#ed1c24' : 'rgba(255,255,255,.16)',
        });
        x += 28;
    });

    return svg('0 0 400 200', 400, 200, body);
}

function watermarkWave() {
    let x = 2;
    let body = '';

    [5, 9, 13, 8, 4, 11, 6].forEach((height, index) => {
        body += rect({
            x,
            y: (13 - height) / 2,
            width: 3.5,
            height,
            rx: 1.5,
            fill: index === 2 ? '#ed1c24' : '#0c0c0d',
        });
        x += 8;
    });

    return svg('0 0 54 13', 54, 13, body);
}

const files = {
    'dobedub-logo-primary.svg': lockup({ ink: '#0c0c0d', red: '#ed1c24' }),
    'dobedub-logo-reversed.svg': lockup({ ink: '#ffffff', red: '#ed1c24' }),
    'dobedub-logo-stacked.svg': lockup({ ink: '#0c0c0d', red: '#ed1c24', kor: true }),
    'dobedub-logo-onred.svg': lockup({ ink: '#ffffff', red: '#0c0c0d', kor: true, korFill: 'rgba(255,255,255,.6)' }),
    'dobedub-header-logo.svg': headerLockup({ ink: '#0c0c0d', red: '#ed1c24', height: 44 }),
    'dobedub-header-logo-reversed.svg': headerLockup({ ink: '#ffffff', red: '#ed1c24', height: 44 }),
    'dobedub-symbol.svg': symbol(),
    'dobedub-avatar-circle.svg': circleAvatar(),
    'dobedub-avatar-squircle.svg': squircleAvatar(),
    'dobedub-appicon-1024.svg': appIcon(120),
    'dobedub-og-wave.svg': ogWave(),
    'dobedub-watermark-wave.svg': watermarkWave(),
    'dobedub-signature-avatar.svg': appIcon(46),
};

for (const [filename, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(outputDir, filename), xml(body));
}

console.log(`Generated ${Object.keys(files).length} brand assets in ${outputDir}`);
