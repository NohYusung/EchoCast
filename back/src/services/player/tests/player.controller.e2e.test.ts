import assert from "node:assert/strict";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../../app.module";
import { createPlayerDraftFixture } from "./player-draft.fixture";

test("GET /player/manifest/:episodeId returns a registered player manifest contract", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  try {
    await request(app.getHttpServer())
      .put("/episodes/sample-player/player-draft")
      .send(createPlayerDraftFixture())
      .expect(200);

    const response = await request(app.getHttpServer())
      .get("/player/manifest/sample-player")
      .expect(200);

    assert.equal(response.body.episodeId, "sample-player");
    assert.equal(response.body.durationMs, 12000);
    assert.equal(JSON.stringify(response.body).includes("spoints"), false);
    assert.equal(JSON.stringify(response.body).includes("positionRatio"), false);
  } finally {
    await app.close();
  }
});

test("PUT /episodes/:episodeId/player-draft persists an independent draft and updates the manifest", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  try {
    await request(app.getHttpServer())
      .put("/episodes/sample-player/player-draft")
      .send(createPlayerDraftFixture())
      .expect(200);

    const draftResponse = await request(app.getHttpServer())
      .get("/episodes/sample-player/player-draft")
      .expect(200);
    const draft = draftResponse.body;

    draft.timelineItems[0] = {
      ...draft.timelineItems[0],
      endTime: 15000,
    };

    const saveResponse = await request(app.getHttpServer())
      .put("/episodes/sample-player/player-draft")
      .send(draft)
      .expect(200);

    assert.equal(saveResponse.body.manifest.durationMs, 15000);

    const manifestResponse = await request(app.getHttpServer())
      .get("/player/manifest/sample-player")
      .expect(200);
    assert.equal(manifestResponse.body.durationMs, 15000);
  } finally {
    await app.close();
  }
});

test("POST /products and POST /products/:productId/episodes create isolated test-player resources", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  try {
    const productResponse = await request(app.getHttpServer())
      .post("/products")
      .send({
        title: "독립 테스트 작품",
        coverImageUrl: "/covers/independent.png",
      })
      .expect(201);

    assert.equal(productResponse.body.title, "독립 테스트 작품");

    const episodeResponse = await request(app.getHttpServer())
      .post(`/products/${productResponse.body.id}/episodes`)
      .send({
        episodeNumber: 2,
        title: "2화",
        subTitle: "새 구조 검증",
      })
      .expect(201);

    assert.equal(episodeResponse.body.productId, productResponse.body.id);
    assert.equal(episodeResponse.body.title, "2화");
  } finally {
    await app.close();
  }
});
