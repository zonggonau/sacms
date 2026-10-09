import { v0 } from "v0";
async function test() {
  try {
    const list = await (v0.chats as any).list({ limit: 5 });
    console.log("Chat List:", JSON.stringify(list, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
