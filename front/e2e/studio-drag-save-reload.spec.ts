import { expect, test, type Page } from "@playwright/test";
import { createSamplePlayerDraft } from "../src/app/_lib/player/sampleDraft";

const apiBaseUrl = "http://127.0.0.1:4100";

test("studio keeps the playhead in place when selecting a cue clip", async ({
  page,
}) => {
  await page.goto("/studio/products/1/episodes/1");

  const playhead = page.locator(".odx-playhead");
  const cueClip = page.locator('[data-testid^="odx-clip-cue-"]').first();

  await expect(playhead).toBeVisible();
  await expect(cueClip).toBeVisible();

  const beforePlayhead = await playhead.getAttribute("aria-valuenow");
  expect(beforePlayhead).not.toBeNull();

  await cueClip.click();

  await expect(cueClip).toHaveClass(/is-selected/);
  await expect(playhead).toHaveAttribute("aria-valuenow", beforePlayhead!);
});

async function dragClipByPixels(
  page: Page,
  testId: string,
  deltaX: number,
) {
  const clip = page.getByTestId(testId);
  const box = await clip.boundingBox();
  if (!box) {
    throw new Error(`clip ${testId} is not visible`);
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY, { steps: 6 });
  await page.mouse.up();
}

test("studio drags media and cue clips, saves the draft, and reloads the same timing", async ({
  page,
  request,
}) => {
  const resetResponse = await request.put(
    `${apiBaseUrl}/episodes/sample-player/player-draft`,
    {
      data: createSamplePlayerDraft(),
    },
  );
  expect(resetResponse.ok()).toBe(true);

  await page.goto("/studio/products/product-100/episodes/sample-player");

  const visualClip = page.getByTestId("timeline-item-visual-cutaway-1");
  const cueClip = page.getByTestId("timeline-item-cue-item-5002");
  await expect(visualClip).toContainText("7800ms - 12800ms");
  await expect(cueClip).toContainText("2600ms - 6200ms");

  await dragClipByPixels(page, "timeline-item-visual-cutaway-1", -30);
  await dragClipByPixels(page, "timeline-item-cue-item-5002", 30);

  await expect(visualClip).toContainText("7200ms - 12200ms");
  await expect(cueClip).toContainText("3200ms - 6800ms");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("saved")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("timeline-item-visual-cutaway-1")).toContainText(
    "7200ms - 12200ms",
  );
  await expect(page.getByTestId("timeline-item-cue-item-5002")).toContainText(
    "3200ms - 6800ms",
  );

  const manifestResponse = await request.get(
    `${apiBaseUrl}/player/manifest/sample-player`,
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  const visualItem = manifest.items.find(
    (item: { id: string }) => item.id === "visual-cutaway-1",
  );
  const cueItem = manifest.items.find(
    (item: { id: string }) => item.id === "cue-item-5002",
  );
  const cue = manifest.cues.find(
    (item: { id: string }) => item.id === "cue-5002",
  );

  expect(visualItem).toMatchObject({ startTime: 7200, endTime: 12200 });
  expect(cueItem).toMatchObject({ startTime: 3200, endTime: 6800 });
  expect(cue).toMatchObject({ startTime: 3200, endTime: 6800 });
});

test("direction screen mirrors the dubright screen-direction workbench structure", async ({
  page,
  request,
}) => {
  const resetResponse = await request.put(
    `${apiBaseUrl}/episodes/sample-player/player-draft`,
    {
      data: createSamplePlayerDraft(),
    },
  );
  expect(resetResponse.ok()).toBe(true);

  await page.goto("/direction/screen/product-100/sample-player");

  await expect(page.getByTestId("dubright-common-title")).toContainText("화면 연출관리");
  await expect(page.locator(".direction-main")).toBeVisible();
  await expect(page.locator(".toon-content-box")).toBeVisible();
  await expect(page.locator("#toon-overlay")).toBeVisible();
  await expect(page.locator(".script-box")).toBeVisible();
  await expect(page.locator(".script-box .header")).toContainText("전체 스크립트");
  await expect(page.locator(".tool-box.bg-primary")).toBeVisible();
  await expect(page.locator(".tool-options-box")).toBeVisible();
  await expect(page.locator(".tool-marker-box")).toBeVisible();
  await expect(page.locator("#workspace-wrapper")).toBeVisible();
  await expect(page.locator("#voice-work-space-main")).toBeVisible();
  await expect(page.locator(".work-space-checkboxes")).toContainText("마커 표시");
  await expect(page.locator(".bottom-btn-box")).toContainText("임시 저장");
  await expect(page.locator(".bottom-btn-box")).toContainText("연출 완료");
});

test("studio uses the new dubright timeline production-tool layout", async ({
  page,
  request,
}) => {
  const resetResponse = await request.put(
    `${apiBaseUrl}/episodes/sample-player/player-draft`,
    {
      data: createSamplePlayerDraft(),
    },
  );
  expect(resetResponse.ok()).toBe(true);

  await page.goto("/studio/products/product-100/episodes/sample-player");

  await expect(page.locator(".dub-studio-app")).toBeVisible();
  await expect(page.locator(".dub-left-preview")).toBeVisible();
  await expect(page.locator(".dub-editor")).toBeVisible();
  await expect(page.locator(".dub-scale-row")).toContainText("Time line scale");
  await expect(page.locator(".dub-track-head").first()).toBeVisible();
  await expect(page.locator(".dub-bottom-bar")).toContainText("임시 저장");
});
