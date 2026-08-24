fetch("https://calculation-near-timber-ultimate.trycloudflare.com/api/mcp")
  .then(res => res.text().then(text => console.log(res.status, text)))
  .catch(err => console.error(err));
