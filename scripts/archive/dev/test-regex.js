const html = '<a href="/foo/bar"> <img src="//cdn.com/a"> <link href="/">';
console.log(html.replace(/(src|href|action)="\/([^\/"][^"]*)?"/g, (match, p1, p2) => {
  return `${p1}="/PROXY/${p2 || ''}"`;
}));
