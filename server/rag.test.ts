import { describe, expect, it } from "vitest";
import { chunkText, cosineSimilarity } from "./rag";

describe("chunkText", () => {
  it("splits text into chunks based on sentences", () => {
    const text = "Hello world. This is a test. Another sentence here. And one more.";
    const chunks = chunkText(text, 10, 2);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toContain("Hello world");
  });

  it("handles empty text", () => {
    const chunks = chunkText("");
    expect(chunks).toEqual([]);
  });

  it("handles text with no sentence breaks", () => {
    const text = "word ".repeat(600);
    const chunks = chunkText(text, 100, 10);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("respects max chunk size", () => {
    const sentences = Array.from({ length: 50 }, (_, i) => `Sentence number ${i}.`).join(" ");
    const chunks = chunkText(sentences, 20, 5);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it("handles empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("handles different length vectors", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("handles zero vectors", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});
