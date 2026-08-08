const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VERCEL_ACCESS_TOKEN=\"?([^\"]+)\"?/);
if(match) {
  fetch('https://api.vercel.com/v9/projects/cms7m0gq4000euj4kzrtznfii', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + match[1].trim() }
  }).then(async r => {
     console.log(r.status);
     console.log(await r.text());
  }).catch(console.error);
}
