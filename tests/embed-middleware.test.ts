import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

describe("embed middleware", () => {
  it("syncs URL embed context into cookies for layouts", () => {
    const request = new NextRequest("https://feedapp.example.com/settings?entryMode=embed&sourceSystem=fihankra-feedback");
    const response = middleware(request);
    const cookies = response.cookies.getAll();

    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "feedback_entry_mode", value: "embed" }),
        expect.objectContaining({ name: "feedback_entry_source", value: "fihankra-feedback" })
      ])
    );
  });
});
