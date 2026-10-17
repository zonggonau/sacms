#!/usr/bin/env node
/**
 * SaCMS SDK Type Generator CLI
 * Generates TypeScript definitions from a remote SaCMS instance's real
 * GraphQL schema, via standard introspection — works against any SaCMS
 * instance the token can reach, no local database access needed.
 *
 * Usage:
 *   npx @sacms/sdk generate --url http://localhost:3000 --tenant demo --token <token> --out src/types/sacms.d.ts
 */
export interface TypeRef {
    kind: string;
    name: string | null;
    ofType: TypeRef | null;
}
export interface IntrospectionField {
    name: string;
    type: TypeRef;
}
export interface IntrospectionType {
    name: string;
    kind: string;
    fields: IntrospectionField[] | null;
}
/** Unwraps NON_NULL/LIST wrappers to the innermost named type, and whether the field is required. */
export declare function unwrap(ref: TypeRef): {
    name: string;
    required: boolean;
};
export declare function scalarToTs(name: string): string;
/** Emits one `export interface TypeName { ... }` from a real introspected object type. */
export declare function buildInterface(typeName: string, type: IntrospectionType): string;
