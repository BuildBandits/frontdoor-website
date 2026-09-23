(() => {
  'use strict';
  const config = document.currentScript.dataset;
  const source = new URL(config.video, location.origin).href;
  const variant = config.variant;
  const report = {version:2,variant,at:new Date().toISOString(),environment:navigator.userAgent,origin:location.origin,video:source,cases:[],events:[]};
  let active = null;
  let timeout;
  let video;
  const state = (v) => ({time:Number(v.currentTime.toFixed(3)),paused:v.paused,muted:v.muted,ready:v.readyState,network:v.networkState,inline:v.playsInline,error:v.error ? {code:v.error.code,message:v.error.message} : null});
  const write = () => {
    const area = document.querySelector('#report');
    if (area) area.value = JSON.stringify(report,null,2);
  };
  const status = (text) => { const el = document.querySelector('#result'); if (el) el.textContent = text; };
  const update = (v,type) => {
    const snapshot = state(v);
    report.events.push({event:type,...snapshot});
    if (report.events.length > 80) report.events.shift();
    if (active && v === video) active.last = snapshot;
    if (type.startsWith('error') && v === video) {
      clearTimeout(timeout);
      status(`Safari non ha caricato il video (errore ${v.error?.code ?? 'non disponibile'}). Prova il pulsante successivo, poi copia l’esito.`);
    }
    if (v === video && v.currentTime > 2 && active && !active.advanced) {
      active.advanced = true;
      clearTimeout(timeout);
      status('Il video sta avanzando. Puoi confrontare le altre prove oppure copiare l’esito.');
    }
    write();
  };
  for (const type of ['loadstart','loadedmetadata','loadeddata','play','playing','waiting','stalled','pause','error','ended']) {
    document.addEventListener(type,e=>{ if(e.target.tagName==='VIDEO') update(e.target,type); },true);
  }
  document.addEventListener('timeupdate',e=>{
    if(e.target===video && active && !active.advanced && video.currentTime>2) update(video,'advanced');
  },true);
  document.addEventListener('securitypolicyviolation',e=>{
    report.events.push({event:'csp',directive:e.effectiveDirective,blocked:e.blockedURI});write();
  });
  document.addEventListener('DOMContentLoaded',()=>{
    video = document.querySelector('#test-video');
    function run(mode) {
      clearTimeout(timeout);
      video.pause();
      if (mode !== 'normal') {
        // Remove and release the previous media; never keep multiple players alive.
        video.removeAttribute('src'); video.load();
        const next = document.createElement('video');
        next.id='test-video'; next.controls=true; next.playsInline=mode!=='fullscreen';
        next.preload='none'; next.width=1280; next.height=720;
        document.querySelector('#player-host').replaceChildren(next);
        video=next;
        video.src=source;
        video.load();
      } else if (video.error || video.readyState===0) {
        video.load();
      }
      active={mode,before:state(video),advanced:false};report.cases.push(active);
      status('Avvio in corso…');
      const selected=active;
      video.play().catch(e=>{
        selected.rejection={name:e.name,message:e.message};
        if(active===selected)status(`Avvio rifiutato (${e.name}). Prova il pulsante successivo, poi copia l’esito.`);
        write();
      });
      timeout=setTimeout(()=>{
        if(active===selected&&!selected.advanced){selected.last=state(video);status('Il video non è avanzato entro 12 secondi. Prova il pulsante successivo, poi copia l’esito.');write();}
      },12000);
      write();
    }
    for(const mode of ['normal','fresh','fullscreen']) document.getElementById(mode).addEventListener('click',()=>run(mode));
    document.querySelector('#copy').addEventListener('click',async()=>{
      if(active)active.last=state(video);
      write();const text=document.querySelector('#report').value;
      try{await navigator.clipboard.writeText(text);document.querySelector('#copy-status').textContent='Copiato. Incolla l’esito nella chat Frontdoor.';}
      catch{document.querySelector('details').open=true;const area=document.querySelector('#report');area.focus();area.select();document.querySelector('#copy-status').textContent='Seleziona e copia il testo qui sotto.';}
    });
    if(video.error)update(video,'error-at-init');
    write();
  });
})();
