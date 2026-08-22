(function(){'use strict';
var addressCodes=[99,111,97,99,104,64,115,108,97,121,101,114,107,101,121,46,99,111,109];
function email(){return String.fromCharCode.apply(null,addressCodes)}
function openMail(){var subject=encodeURIComponent('Portfolio inquiry');window.location.href='mailto:'+email()+'?subject='+subject}

var experience=document.querySelector('.experience');
if(experience)experience.remove();
var experienceLink=document.querySelector('.site-nav a[href="#experience"]');
var tools=document.querySelector('.tools');
if(tools)tools.id='tools';
if(experienceLink){experienceLink.href='#tools';experienceLink.textContent='Tools'}

var tiktokPath='M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';
var valorantPath='M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z';
function lockup(path,name){return '<span class="logo-brand-lockup"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="'+path+'"></path></svg><strong>'+name+'</strong></span>'}

var brandNames=['Whatnot','TikTok','Metafy','ProGuides','ZOWIE','MrBeast','VALORANT'];
document.querySelectorAll('.logo-set').forEach(function(set){
  Array.prototype.slice.call(set.children).forEach(function(logo,index){
    var name=brandNames[index]||'Brand';
    logo.dataset.brand=name;
    if(name==='TikTok'){
      logo.className='logo logo-tiktok';
      logo.innerHTML=lockup(tiktokPath,'TikTok');
      return;
    }
    if(name==='ZOWIE'){
      logo.className='logo logo-text logo-zowie-word';
      logo.textContent='ZOWIE';
      return;
    }
    if(name==='VALORANT'){
      logo.className='logo logo-text logo-valorant-word';
      logo.innerHTML=lockup(valorantPath,'VALORANT');
      return;
    }
  });
});

document.querySelectorAll('.logo img').forEach(function(img){
  function fallback(){
    var parent=img.closest('.logo');
    if(!parent)return;
    var name=parent.dataset.brand||img.alt||'';
    if(name==='MrBeast'){
      img.remove();
      return;
    }
    if(name){
      parent.className='logo logo-text';
      parent.textContent=name.toUpperCase();
    }
  }
  img.addEventListener('error',fallback,{once:true});
  if(img.complete&&img.naturalWidth===0)fallback();
});

document.querySelectorAll('.tool-icon img').forEach(function(img){
  function fallback(){if(img.parentNode)img.remove()}
  img.addEventListener('error',fallback,{once:true});
  if(img.complete&&img.naturalWidth===0)fallback();
});

var modal=document.createElement('div');
modal.className='contact-modal';
modal.setAttribute('aria-hidden','true');
modal.innerHTML='<button class="contact-close" type="button" aria-label="Close">×</button><div class="contact-card" role="dialog" aria-modal="true" aria-labelledby="contact-title"><h3 id="contact-title">Start a conversation</h3><p>If you are reaching out about product, AI workflows, creator systems, content, community, or something adjacent, email is the easiest way to reach me.</p><div class="modal-actions"><button class="button primary" id="open-email" type="button">Open email</button><button class="button secondary" id="close-email" type="button">Cancel</button></div></div>';
document.body.appendChild(modal);
function show(){modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
function hide(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}
document.querySelectorAll('.contact-trigger').forEach(function(btn){btn.addEventListener('click',show)});
modal.querySelector('#open-email').addEventListener('click',openMail);
modal.querySelector('#close-email').addEventListener('click',hide);
modal.querySelector('.contact-close').addEventListener('click',hide);
modal.addEventListener('click',function(e){if(e.target===modal)hide()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')hide()});
})();