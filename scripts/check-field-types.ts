import fs from "fs";
import { FIELD_TYPES } from "../src/lib/field-types";

const content = fs.readFileSync("./src/lib/ai-schema-generator.ts", "utf8");
const valid = new Set(FIELD_TYPES.map(f => f.type));
const regex = /type:\s*["']([^"']+)["']/g;
let m;
const found: string[] = [];
while ((m = regex.exec(content)) !== null) {
  found.push(m[1]);
}
const invalid = found.filter(t => !valid.has(t));
console.log("Total types checked in ai-schema-generator:", found.length);
console.log("Unique types used:", [...new Set(found)]);
console.log("Invalid types:", invalid);
