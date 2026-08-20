fetch("https://calculation-near-timber-ultimate.trycloudflare.com/.well-known/oauth-authorization-server")
  .then(res => res.text().then(text => console.log(res.status, text.slice(0, 50))))
  .catch(err => console.error(err));
