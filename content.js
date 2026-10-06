window.escapeText = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.assetUrl = value => window.BlogStaticData && /^\/(?:assets|media)\//.test(value) ? '.'+value : value;
window.coverUrl = value => window.assetUrl(/^\/assets\/[\w./-]+$/.test(value)?value:/^[\w.-]+$/.test(value)?'/assets/'+value:'/assets/study-life.png');
window.renderMarkdown = text => {
  const imageMarkup=(alt,url)=>{
    if(!/^\/assets\/[\w./-]+$/.test(url)&&!/^https:\/\/[^\s<>"']+$/.test(url))return null;
    return `<img class="article-content-image" src="${escapeText(window.assetUrl(url))}" alt="${escapeText(alt)}" loading="lazy" decoding="async">`;
  };
  let code=false, lines=[];
  for(const line of String(text||'').split('\n')){
    if(line.startsWith('```')){lines.push(code?'</code></pre>':'<pre><code>');code=!code;continue;}
    const safe=escapeText(line);
    if(code){lines.push(safe+'\n');continue;}
    if(!line.trim()){lines.push('<div class="article-blank-line" aria-hidden="true"></div>');continue;}
    const image=line.trim().match(/^!\[([^\]]*)\]\(([^\s)]+)\)$/);
    if(image){const markup=imageMarkup(image[1],image[2]);lines.push(markup?`<figure class="article-figure">${markup}${image[1]?`<figcaption>${escapeText(image[1])}</figcaption>`:''}</figure>`:`<p>${safe}</p>`);continue;}
    const heading=line.match(/^(#{1,3}) /);
    if(heading){const n=heading[1].length+1;lines.push(`<h${n}>${escapeText(line.slice(heading[0].length))}</h${n}>`);}
    else if(line.startsWith('> '))lines.push('<blockquote>'+escapeText(line.slice(2))+'</blockquote>');
    else if(line.trim())lines.push('<p>'+safe.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>')+'</p>');
  }
  if(code)lines.push('</code></pre>');return lines.join('');
};
