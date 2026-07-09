const fs = require('fs');

function replaceWithHtml(file, searchStr, className, varName) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let newHtml = `<div className="${className} [&>p]:mb-0 [&_p]:mb-0" dangerouslySetInnerHTML={{ __html: ${varName} || '' }} />`;
  
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, newHtml);
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
}

replaceWithHtml('src/components/landing/sections/sectors-section.tsx',
  '<p className="text-sm text-muted-foreground leading-relaxed font-medium">{sector.description}</p>',
  'text-sm text-muted-foreground leading-relaxed font-medium',
  'sector.description');

replaceWithHtml('src/components/landing/sections/pricing-grid.tsx',
  '<p className="text-xs text-muted-foreground mb-6 min-h-[40px] font-medium leading-relaxed">{plan.description}</p>',
  'text-xs text-muted-foreground mb-6 min-h-[40px] font-medium leading-relaxed',
  'plan.description');

replaceWithHtml('src/components/landing/sections/papua-challenges.tsx',
  '<p className="text-sm text-muted-foreground leading-relaxed font-medium">{challenge.description}</p>',
  'text-sm text-muted-foreground leading-relaxed font-medium',
  'challenge.description');

replaceWithHtml('src/components/landing/sections/papua-tech-stack.tsx',
  '<p className="text-sm text-muted-foreground leading-relaxed font-medium">{item.description}</p>',
  'text-sm text-muted-foreground leading-relaxed font-medium',
  'item.description');

replaceWithHtml('src/components/landing/sections/papua-initiatives.tsx',
  '<p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">{item.description}</p>',
  'text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium',
  'item.description');

replaceWithHtml('src/components/landing/sections/papua-connected-sites.tsx',
  '<p className="text-xs text-muted-foreground leading-relaxed font-medium">{site.description}</p>',
  'text-xs text-muted-foreground leading-relaxed font-medium',
  'site.description');
