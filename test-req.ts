const req = new Request("http://localhost:3000/api/mcp");
const url = new URL(req.url);
url.host = "example.com";
url.protocol = "https:";
const patched = new Request(url.toString(), {
    method: "GET",
    headers: { "host": "example.com" },
    body: req.body,
    duplex: 'half'
} as any);

console.log("Patched URL:", patched.url);
