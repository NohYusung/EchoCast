import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../StudioProductDashboard.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../../styles.css', import.meta.url), 'utf8');

test('product cards expose hover more menu with edit and delete actions', () => {
    assert.match(source, /className=\{`tp-product-menu-button/);
    assert.match(source, /aria-haspopup="menu"/);
    assert.match(source, /role="menu"/);
    assert.match(
        source,
        /<StudioCatalogIcon name="edit" \/>[\s\S]*수정[\s\S]*<StudioCatalogIcon name="trash" \/>[\s\S]*삭제/
    );
    assert.match(styles, /\.tp-product-card:hover \.tp-product-menu-button[\s\S]*?opacity: 1;/);
    assert.match(styles, /\.tp-product-menu\.open[\s\S]*?display: grid;/);
});

test('product edit and delete actions call product mutation APIs', () => {
    assert.match(source, /const openEditModal = \(product: StudioProduct\)/);
    assert.match(source, /await updateProduct\(editingProduct\.id, productRequest\)/);
    assert.match(source, /await deleteProduct\(productToDelete\.id\)/);
    assert.match(source, /\/products\/\$\{productId\}[\s\S]*?method: 'PUT'/);
    assert.match(source, /\/products\/\$\{productId\}[\s\S]*?method: 'DELETE'/);
    assert.match(source, /setProducts\(\(current\) => current\.filter/);
    assert.match(source, /프로젝트를 삭제할까요\?/);
});

test('product edit modal maps backend subtitle to the logline field', () => {
    assert.match(source, /subtitle\?: string;/);
    assert.match(source, /setLogline\(product\.logline\)/);
    assert.match(source, /logline: product\.subtitle \?\? ''/);
    assert.match(source, /subtitle: isEditingProduct \? trimmedLogline : trimmedLogline \|\| undefined/);
    assert.match(source, /if \(coverImageUrl\)[\s\S]*productRequest\.coverImageUrl = coverImageUrl/);
});
