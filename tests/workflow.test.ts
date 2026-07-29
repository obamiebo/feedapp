import { describe, expect, it } from "vitest";
import { assertValidTransition, canTransition, getAllowedTransitions } from "@/lib/workflow";

describe("case workflow", () => {
  it("allows core lifecycle transitions", () => {
    expect(canTransition("New", "Assigned")).toBe(true);
    expect(canTransition("Assigned", "In Progress")).toBe(true);
    expect(canTransition("Resolved", "Closed")).toBe(true);
    expect(canTransition("Closed", "Reopened")).toBe(true);
  });

  it("blocks unsupported transitions", () => {
    expect(canTransition("New", "Resolved")).toBe(false);
    expect(() => assertValidTransition("Closed", "In Progress")).toThrow("Invalid case transition");
  });

  it("returns transition options for a status", () => {
    expect(getAllowedTransitions("Resolved")).toEqual(["Closed", "Reopened"]);
  });
});
