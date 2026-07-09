const fs = require('fs');

function replaceWithHtml(file, searchStr, className, varName, isQuote = false) {
  let content = fs.readFileSync(file, 'utf8');
  let newHtml = `<div className="${className} [&>p]:mb-0 [&_p]:mb-0" dangerouslySetInnerHTML={{ __html: ${varName} || '' }} />`;
  if (isQuote) {
    newHtml = `<div className="${className} [&>p]:mb-0 [&_p]:mb-0">\n                  &quot;<span dangerouslySetInnerHTML={{ __html: ${varName} || '' }} />&quot;\n                </div>`;
  }
  
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, newHtml);
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  } else {
    console.log('Could not find string in ' + file);
  }
}

replaceWithHtml('src/components/landing/sections/about-section.tsx', 
  '<p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-medium">\n            {about.description}\n            </p>', 
  'text-lg md:text-xl text-muted-foreground leading-relaxed font-medium', 
  'about.description');

replaceWithHtml('src/components/landing/sections/addons-section.tsx',
  '<p className="text-sm text-muted-foreground leading-relaxed font-medium">{addon.description}</p>',
  'text-sm text-muted-foreground leading-relaxed font-medium',
  'addon.description');

replaceWithHtml('src/components/landing/sections/cta-banner.tsx',
  '<p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto opacity-90 leading-relaxed font-medium">\n              {cta.description}\n            </p>',
  'text-lg md:text-xl mb-10 max-w-2xl mx-auto opacity-90 leading-relaxed font-medium',
  'cta.description');

replaceWithHtml('src/components/landing/sections/faq-section.tsx',
  '<div className="px-6 pb-6 text-base text-muted-foreground leading-relaxed font-medium">\n                      {item.answer}\n                    </div>',
  'px-6 pb-6 text-base text-muted-foreground leading-relaxed font-medium',
  'item.answer');

replaceWithHtml('src/components/landing/sections/features-bento.tsx',
  '<p className="text-muted-foreground leading-relaxed text-sm">{feature.description}</p>',
  'text-muted-foreground leading-relaxed text-sm',
  'feature.description');

replaceWithHtml('src/components/landing/sections/testimonials-section.tsx',
  '<p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 italic font-medium">"{t.content}"</p>',
  'text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 italic font-medium',
  't.content', true);

replaceWithHtml('src/components/landing/sections/workflow-section.tsx',
  '<p className="text-xs text-muted-foreground leading-relaxed font-medium">{step.description}</p>',
  'text-xs text-muted-foreground leading-relaxed font-medium',
  'step.description');
