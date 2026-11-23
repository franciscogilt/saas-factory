import express from "express";

export const app = express();
app.use(express.json());

app.get("/api/users", (_req, res) => {
  res.json([{ id: 1, name: "Ana" }]);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
