import { v0 } from "v0"

async function run() {
  const chat = await v0.chats.getPreview({ chatId: "chLBNbMLKIh" })
  console.log(JSON.stringify(chat, null, 2))
}

run()
