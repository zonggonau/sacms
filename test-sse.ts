const url = "https://calculation-near-timber-ultimate.trycloudflare.com/api/mcp";
const req = fetch(url, {
  method: "GET",
  headers: {
    "Accept": "text/event-stream",
    "Authorization": "Bearer YOUR_TOKEN"
  }
}).then(res => {
  console.log("Status:", res.status);
  console.log("Content-Type:", res.headers.get("content-type"));
  
  if (!res.ok) {
    res.text().then(t => console.log("Error body:", t.slice(0, 100)));
    return;
  }
  
  const reader = res.body?.getReader();
  if (reader) {
    reader.read().then(function processText({ done, value }) {
      if (done) return;
      console.log("Chunk:", new TextDecoder().decode(value));
      reader.read().then(processText);
    });
  }
});
