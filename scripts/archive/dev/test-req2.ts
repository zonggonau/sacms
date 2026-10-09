const url = new URL("http://localhost:3000/api/mcp");
url.host = "calculation-near-timber-ultimate.trycloudflare.com";
url.protocol = "https:";
console.log("Using .host =", url.toString());

const url2 = new URL("http://localhost:3000/api/mcp");
url2.hostname = "calculation-near-timber-ultimate.trycloudflare.com";
url2.protocol = "https:";
console.log("Using .hostname =", url2.toString());

const url3 = new URL("http://localhost:3000/api/mcp");
url3.hostname = "calculation-near-timber-ultimate.trycloudflare.com";
url3.port = "";
url3.protocol = "https:";
console.log("With port='' =", url3.toString());
