/**
 * Default, empty registry shipped with the package — no tenant-specific
 * schema is baked in here. `npx @sacms/sdk generate` produces your own
 * registry file from your real workspace; pass it to `new SaCMS<MyRegistry>`
 * instead of relying on this default (see client.ts's class doc comment).
 */

export interface SaCMSRegistryShape {
  collections: Record<string, unknown>
  singles: Record<string, unknown>
}

/**
 * `{}` here is deliberate and load-bearing, not a placeholder for
 * `Record<string, never>`: an index-signature type like `Record<string,
 * never>` still matches *any* string key (just resolving its value to
 * `never`), so `collection("articles")` would keep hitting the typed
 * overload and silently infer `never` instead of falling through to the
 * untyped `Record<string, unknown>` overload. A closed `{}` has no keys at
 * all, so `keyof {}` is `never` and no real slug can ever match it —
 * exactly the "untyped by default" behavior this default is for.
 */
export interface EmptyRegistry extends SaCMSRegistryShape {
  collections: {}
  singles: {}
}
