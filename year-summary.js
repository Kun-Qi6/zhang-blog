window.BlogYearSummary = (()=>{
  function dateParts(value){
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');if(!match)return null;
    const [year,month,day]=match.slice(1).map(Number),date=new Date(Date.UTC(year,month-1,day));
    return year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?{year,month,day}:null;
  }
  function published(items){
    const unique=new Map();
    for(const article of items||[]){
      if(article.published!==true||!article.id||!dateParts(article.date))continue;
      const previous=unique.get(article.id);
      if(!previous||String(article.updatedAt||'')>=String(previous.updatedAt||''))unique.set(article.id,article);
    }
    return [...unique.values()].sort((a,b)=>b.date.localeCompare(a.date));
  }
  function calculate(items,year,now=new Date()){
    const all=published(items),posts=all.filter(item=>dateParts(item.date).year===year);
    const counts={reading:0,tech:0,exam:0},monthly=Array(12).fill(0);
    for(const post of posts){if(Object.hasOwn(counts,post.kind))counts[post.kind]++;monthly[dateParts(post.date).month-1]++}
    const beginning=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1);
    const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    const days=Math.max(0,Math.min((end-beginning)/86400000,Math.floor((today-beginning)/86400000)+1));
    return {year,total:posts.length,lifetime:all.length,counts,monthly,days,elapsed:Math.round(days/((end-beginning)/86400000)*100),years:[...new Set([now.getFullYear(),...all.map(item=>dateParts(item.date).year)])].sort((a,b)=>b-a)};
  }
  return {dateParts,published,calculate};
})();
