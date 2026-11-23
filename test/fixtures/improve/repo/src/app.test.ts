import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("users", () => {
  it("lista usuarios", async () => {
    const r = await request(app).get("/api/users");
    expect(r.status).toBe(200);
  });
});
