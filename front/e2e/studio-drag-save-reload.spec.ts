import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function dragLocatorByPixels(
  page: Page,
  locator: Locator,
  deltaX: number,
  deltaY: number,
) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("target locator is not visible");
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 6 });
  await page.mouse.up();
}

async function dragClipByPixels(
  page: Page,
  testId: string,
  deltaX: number,
) {
  const clip = page.getByTestId(testId);
  await dragLocatorByPixels(page, clip, deltaX, 0);
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

test("studio loads the image composition tool from cut edit mode", async ({
  page,
}) => {
  let canvasCreatePayload: unknown = null;
  await page.route("**/episodes/1/medias", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              id: 201,
              episodeId: 1,
              mediaName: "이미지 01",
              mediaType: "image",
              mediaUrl:
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 520'%3E%3Crect width='360' height='520' fill='%232563eb'/%3E%3Ctext x='180' y='260' fill='white' font-size='36' text-anchor='middle'%3E01%3C/text%3E%3C/svg%3E",
              index: 0,
            },
            {
              id: 202,
              episodeId: 1,
              mediaName: "이미지 02",
              mediaType: "image",
              mediaUrl:
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 520'%3E%3Crect width='360' height='520' fill='%2316a34a'/%3E%3Ctext x='180' y='260' fill='white' font-size='36' text-anchor='middle'%3E02%3C/text%3E%3C/svg%3E",
              index: 1,
            },
            {
              id: 303,
              episodeId: 1,
              mediaName: "새 컷 이미지",
              mediaType: "image",
              mediaUrl:
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 520'%3E%3Crect width='360' height='520' fill='%23f97316'/%3E%3Ctext x='180' y='260' fill='white' font-size='36' text-anchor='middle'%3E03%3C/text%3E%3C/svg%3E",
              index: 2,
            },
          ],
          total: 3,
        },
      }),
    });
  });
  await page.route("**/episodes/1/canvases", async (route) => {
    if (route.request().method() === "POST") {
      canvasCreatePayload = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: 901,
            episodeId: 1,
            medias: canvasCreatePayload,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              id: 101,
              episodeId: 1,
              mediaId: 201,
              mediaName: "이미지 01",
              mediaType: "image",
              mediaUrl:
                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 520'%3E%3Crect width='360' height='520' fill='%232563eb'/%3E%3Ctext x='180' y='260' fill='white' font-size='36' text-anchor='middle'%3E01%3C/text%3E%3C/svg%3E",
              index: 0,
              medias: [
                {
                  mediaId: 201,
                  mediaName: "이미지 01",
                  mediaType: "image",
                  mediaUrl:
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 520'%3E%3Crect width='360' height='520' fill='%232563eb'/%3E%3Ctext x='180' y='260' fill='white' font-size='36' text-anchor='middle'%3E01%3C/text%3E%3C/svg%3E",
                  index: 0,
                },
                {
                  mediaId: 202,
                  mediaName: "이미지 02",
                  mediaType: "image",
                  mediaUrl:
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 520'%3E%3Crect width='360' height='520' fill='%2316a34a'/%3E%3Ctext x='180' y='260' fill='white' font-size='36' text-anchor='middle'%3E02%3C/text%3E%3C/svg%3E",
                  index: 1,
                },
              ],
            },
          ],
          total: 1,
        },
      }),
    });
  });

  await page.goto("/studio/products/1/episodes/1");
  await page.getByRole("button", { name: "미디어" }).click();
  const droppedMedia = page.getByRole("button", { name: /새 컷 이미지/ });
  await expect(droppedMedia).toHaveAttribute("draggable", "true");

  await page.getByRole("button", { name: "컷 편집" }).click();

  await expect(page.getByLabel("컷 편집 작업 영역")).toBeVisible();
  await expect(page.getByText("컷 목록", { exact: true })).toHaveCount(0);
  await expect(page.locator(".odx-cut-edit-stage")).toBeVisible();
  await expect(page.locator(".odx-cut-edit-props")).toContainText("노출 시간");
  await expect(page.locator(".odx-canvas")).toBeHidden();
  await droppedMedia.dragTo(page.locator(".odx-cut-edit-viewport"));

  const cutBlocks = page.locator(".odx-cut-edit-block");
  await expect(cutBlocks).toHaveCount(3);
  await expect(page.locator(".odx-cut-edit-strip")).toContainText("새 컷 이미지");
  await dragLocatorByPixels(page, cutBlocks.nth(2), 0, -260);
  await expect(cutBlocks.nth(1)).toContainText("새 컷 이미지");
  await expect(page.getByLabel("이미지 편집 툴")).toBeVisible();
  await expect(page.getByRole("button", { name: "이미지 01 레이어 선택" })).toBeVisible();
  await expect(page.getByRole("button", { name: "새 컷 이미지 레이어 선택" })).toBeVisible();
  await expect(page.locator(".odx-body")).toHaveClass(/is-editing-cuts/);
  await expect(page.locator(".odx-inspector")).toBeHidden();

  await page.getByRole("button", { name: "이미지 조합 확정" }).click();
  await expect
    .poll(() => canvasCreatePayload, { message: "canvas create payload" })
    .toMatchObject({
      medias: [
        {
          mediaId: 201,
          mediaName: "이미지 01",
          mediaType: "image",
          index: 0,
          x: 50,
          y: 50,
          scale: 1,
          opacity: 1,
        },
        {
          mediaId: 303,
          mediaName: "새 컷 이미지",
          mediaType: "image",
          index: 1,
          x: 50,
          y: 50,
          scale: 1,
          opacity: 1,
        },
        {
          mediaId: 202,
          mediaName: "이미지 02",
          mediaType: "image",
          index: 2,
          x: 50,
          y: 50,
          scale: 1,
          opacity: 1,
        },
      ],
    });
  await expect(page.getByLabel("이미지 편집 툴")).toContainText("확정됨");
});
