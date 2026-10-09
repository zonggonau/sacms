import { v0 } from "v0";
async function test() {
  try {
    const chat = await v0.chats.create({ message: "hello" });
    console.log("Chat Object:", JSON.stringify(chat, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
