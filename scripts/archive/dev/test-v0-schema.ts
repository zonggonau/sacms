import { v0 } from "v0";
async function test() {
  const prompt = `You are an expert Headless CMS database architect. 
Given a user's description of a website they want to build, generate the necessary database schemas.
Use a mix of Content Types (for collections), Single Types (for one-off pages or settings), and Components (for reusable field groups).

You MUST respond by generating a single file named "schema.json" exactly matching this structure:
{
  "contentTypes": [ { "name": "String", "slug": "String", "description": "String", "fields": [ { "name": "String", "slug": "String", "type": "text | richtext | number | boolean | date | media | json | relation | component", "required": false, "unique": false } ] } ],
  "singleTypes": [],
  "components": []
}

Do NOT generate any React components or UI yet. Only the schema.json file.

User description: A simple blog.`;

  try {
    const chat = await v0.chats.create({ message: prompt });
    console.log("Chat Response:", JSON.stringify(chat, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
