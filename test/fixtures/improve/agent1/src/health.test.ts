import { it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";

it("GET /health responde ok", async () => {
  const r = await request(app).get("/health");
  expect(r.status).toBe(200);
  expect(r.body.status).toBe("ok");
});
