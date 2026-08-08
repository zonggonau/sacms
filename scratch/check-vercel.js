const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/VERCEL_ACCESS_TOKEN=\"?([^\"]+)\"?/);
if(match) {
  fetch('https://api.vercel.com/v9/projects', {
    headers: { Authorization: 'Bearer ' + match[1].trim() }
  }).then(r => r.json()).then(data => {
    if (data.projects) {
       console.log('Projects:', data.projects.map(p => p.name).join(', '));
    } else {
       console.log('Error:', data);
    }
  }).catch(console.error);
}
