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

var brandNames=['Whatnot','TikTok','Metafy','ProGuides','ZOWIE','MrBeast','VALORANT'];
document.querySelectorAll('.logo-set').forEach(function(set){
  Array.prototype.slice.call(set.children).forEach(function(logo,index){
    var name=brandNames[index]||'Brand';
    logo.dataset.brand=name;
    if(name==='ZOWIE'){
      logo.className='logo logo-text logo-zowie-word';
      logo.textContent='ZOWIE';
    }
    if(name==='VALORANT'){
      logo.className='logo logo-text logo-valorant-word';
      logo.textContent='VALORANT';
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