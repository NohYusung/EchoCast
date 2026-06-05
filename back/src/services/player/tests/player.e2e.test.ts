import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../../app.module";

describe("Player API", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a product and episode without database entities", async () => {
    const productResponse = await request(app.getHttpServer())
      .post("/products")
      .send({ title: "신규 작품", coverImageUrl: "/covers/new.png" })
      .expect(201);

    assert.deepEqual(productResponse.body, {
      id: "product-200",
      title: "신규 작품",
      coverImageUrl: "/covers/new.png",
    });

    const episodeResponse = await request(app.getHttpServer())
      .post(`/products/${productResponse.body.id}/episodes`)
      .send({
        episodeNumber: 1,
        title: "1화",
        subTitle: "테스트",
      })
      .expect(201);

    assert.deepEqual(episodeResponse.body, {
      id: "episode-500",
      productId: productResponse.body.id,
      episodeNumber: 1,
      title: "1화",
      subTitle: "테스트",
    });
  });
});
