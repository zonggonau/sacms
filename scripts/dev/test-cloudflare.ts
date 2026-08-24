fetch("https://calculation-near-timber-ultimate.trycloudflare.com/api/mcp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer token"
  },
  body: JSON.stringify({ method: "test" })
})
  .then(res => res.text().then(text => console.log("Status:", res.status, "Body:", text.slice(0, 100))))
  .catch(err => console.error(err));
