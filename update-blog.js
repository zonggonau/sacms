const fs = require('fs');
let content = fs.readFileSync('src/app/blog/page.tsx', 'utf8');

content = content.replace(/blog\.image_url/g, 'blog.cover_image');
content = content.replace(/blog\.excerpt/g, `(blog.excerpt || (blog.content ? blog.content.replace(/<[^>]+>/g, '') : ''))`);
content = content.replace(/blog\.author/g, 'blog.category');

fs.writeFileSync('src/app/blog/page.tsx', content);
console.log('Updated src/app/blog/page.tsx');
