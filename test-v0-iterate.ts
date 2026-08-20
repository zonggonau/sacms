import { v0 } from "v0";
async function test() {
  try {
    const res = await v0.messages.send({ chatId: "jDjypJdod86", message: "Make it red" });
    console.log("Send Object:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
