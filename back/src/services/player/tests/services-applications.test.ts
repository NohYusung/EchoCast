import assert from "node:assert/strict";
import { test } from "node:test";
import { DddService } from "../../../libs/ddd";
import { ProductService } from "../../products/applications/product.service";

test("product application service extends DddService", () => {
  assert.equal(
    ProductService.prototype instanceof DddService,
    true,
    "ProductService must extend DddService",
  );
});
