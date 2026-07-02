(function(){
  var KEY='satus_lang';
  function apply(lang){
    var en=lang==='en';
    document.querySelectorAll('[data-en]').forEach(function(el){
      if(el._pt===undefined)el._pt=el.textContent;
      el.textContent=en?el.getAttribute('data-en'):el._pt;
    });
    document.querySelectorAll('[data-en-html]').forEach(function(el){
      if(el._ptH===undefined)el._ptH=el.innerHTML;
      el.innerHTML=en?el.getAttribute('data-en-html'):el._ptH;
    });
    document.querySelectorAll('[data-en-ph]').forEach(function(el){
      if(el._ptP===undefined)el._ptP=el.placeholder;
      el.placeholder=en?el.getAttribute('data-en-ph'):el._ptP;
    });
    document.querySelectorAll('.lang-btn').forEach(function(b){
      b.textContent=en?'PT':'EN';
    });
    document.documentElement.lang=en?'en':'pt';
    localStorage.setItem(KEY,lang);
  }
  window.toggleLang=function(){apply(localStorage.getItem(KEY)==='en'?'pt':'en');};
  var saved=localStorage.getItem(KEY);
  if(saved==='en'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){apply('en');});
    else apply('en');
  }
})();
