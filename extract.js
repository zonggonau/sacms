const fs = require('fs');

const text = fs.readFileSync('C:\\Users\\nau\\.gemini\\antigravity-ide\\brain\\246ca368-4a67-4e4d-8c21-05627755be8b\\.system_generated\\logs\\transcript_full.jsonl', 'utf8');

const parseLines = () => {
  const lines = text.split('\n');
  let blogFound = false;
  let planFound = false;
  for (const line of lines) {
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.arguments && tc.arguments.TargetFile && tc.arguments.TargetFile.includes('blog-manager.tsx')) {
             if (tc.arguments.CodeContent) {
                fs.writeFileSync('src/app/(system)/admin/settings/blog-manager.tsx', tc.arguments.CodeContent);
                blogFound = true;
                console.log('Restored blog-manager.tsx');
             }
          }
          if (tc.arguments && tc.arguments.TargetFile && tc.arguments.TargetFile.includes('plan-manager.tsx')) {
             if (tc.arguments.CodeContent) {
                fs.writeFileSync('src/app/(system)/admin/settings/plan-manager.tsx', tc.arguments.CodeContent);
                planFound = true;
                console.log('Restored plan-manager.tsx');
             }
          }
        }
      }
    } catch(e) {}
  }
  return { blogFound, planFound };
};

const res = parseLines();

if (!res.blogFound) {
  // Regex fallback
  const regexBlog = /"CodeContent":"(.*?)","Description":".*?","Overwrite":(true|false),"TargetFile":"[^"]*blog-manager\.tsx"/g;
  const matchBlog = regexBlog.exec(text);
  if (matchBlog) {
    const content = JSON.parse('"' + matchBlog[1] + '"');
    fs.writeFileSync('src/app/(system)/admin/settings/blog-manager.tsx', content);
    console.log('Restored blog-manager.tsx v2');
  } else {
    console.log('blog-manager not found in regex');
  }
}

if (!res.planFound) {
  const regexPlan = /"CodeContent":"(.*?)","Description":".*?","Overwrite":(true|false),"TargetFile":"[^"]*plan-manager\.tsx"/g;
  const matchPlan = regexPlan.exec(text);
  if (matchPlan) {
    const content = JSON.parse('"' + matchPlan[1] + '"');
    fs.writeFileSync('src/app/(system)/admin/settings/plan-manager.tsx', content);
    console.log('Restored plan-manager.tsx v2');
  } else {
     console.log('plan-manager not found in regex');
  }
}
