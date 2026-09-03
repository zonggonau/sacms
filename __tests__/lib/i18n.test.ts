import { describe, it, expect } from "vitest"
import { DICTIONARY, LOCALES, DEFAULT_LOCALE, isLocale } from "@/lib/i18n/dictionaries"

describe("i18n dictionary", () => {
  it("exposes id and en", () => {
    expect(LOCALES).toEqual(["id", "en"])
    expect(DEFAULT_LOCALE).toBe("id")
    expect(DICTIONARY.id).toBeDefined()
    expect(DICTIONARY.en).toBeDefined()
  })

  it("isLocale guards unknown values", () => {
    expect(isLocale("id")).toBe(true)
    expect(isLocale("en")).toBe(true)
    expect(isLocale("fr")).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })

  it("id and en have the same key structure (deep)", () => {
    const shape = (o: unknown): unknown => {
      if (Array.isArray(o)) return o.map(shape)
      if (o && typeof o === "object") {
        return Object.fromEntries(
          Object.keys(o as object)
            .sort()
            .map((k) => [k, shape((o as Record<string, unknown>)[k])]),
        )
      }
      return typeof o
    }
    expect(shape(DICTIONARY.en)).toEqual(shape(DICTIONARY.id))
  })

  it("carries the new cross-cutting namespaces", () => {
    for (const l of LOCALES) {
      expect(DICTIONARY[l].common.save).toBeTruthy()
      expect(DICTIONARY[l].errors.forbidden).toBeTruthy()
      expect(DICTIONARY[l].email.verify.subject).toContain("{brand}")
    }
  })

  it("localises id vs en", () => {
    expect(DICTIONARY.id.common.save).toBe("Simpan")
    expect(DICTIONARY.en.common.save).toBe("Save")
  })
})
