import { describe, it, expect } from "vitest"
import { PROPOSAL_STAGES, TERMINAL_STAGES, isValidStage, getStageLabel } from "@/lib/proposal-stages"

describe("proposal-stages", () => {
  it("defines a consistent, ordered pipeline from draft to a terminal outcome", () => {
    expect(PROPOSAL_STAGES.map((s) => s.key)).toEqual(["draft", "sent", "negotiation", "won", "lost"])
  })

  it("every stage key is unique", () => {
    const keys = PROPOSAL_STAGES.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("won and lost are the only terminal stages", () => {
    expect(TERMINAL_STAGES.sort()).toEqual(["lost", "won"])
  })

  it("isValidStage accepts every real stage and rejects junk", () => {
    for (const stage of PROPOSAL_STAGES) {
      expect(isValidStage(stage.key)).toBe(true)
    }
    expect(isValidStage("nonexistent")).toBe(false)
  })

  it("getStageLabel returns the label, falling back to the raw value for an unknown stage", () => {
    expect(getStageLabel("won")).toBe("Kontrak Ditandatangani")
    expect(getStageLabel("something-else")).toBe("something-else")
  })
})
