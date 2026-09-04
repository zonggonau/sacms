/**
 * Conditional field visibility ("show field B only if field A = X").
 *
 * A field's `options.showIf` (set via FieldConfigModal) is a single
 * condition: { targetFieldSlug, operator: "equals" | "notEquals", value }.
 * Scoped intentionally to one condition against a scalar field — enough for
 * the common case ("show discount % if status = promo") without building a
 * full expression/rule engine.
 */

export interface ShowIfCondition {
  targetFieldSlug?: string
  operator?: "equals" | "notEquals"
  value?: string
}

/** True when a field should be rendered given the current form values. */
export function isFieldVisible(field: { options?: any }, formData: Record<string, unknown>): boolean {
  const opts = typeof field?.options === "string" ? safeParse(field.options) : field?.options
  const showIf: ShowIfCondition | undefined = opts?.showIf
  if (!showIf?.targetFieldSlug) return true

  const actual = formData[showIf.targetFieldSlug]
  const actualStr = actual === null || actual === undefined ? "" : String(actual)
  const expectedStr = showIf.value ?? ""

  const matches = actualStr === expectedStr
  return showIf.operator === "notEquals" ? !matches : matches
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
