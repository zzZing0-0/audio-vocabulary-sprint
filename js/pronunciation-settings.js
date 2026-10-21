/* Device-local speech preferences; library continuous playback keeps its own settings. */
(function(g){
  const KEY='audio_vocab_sprint_pronunciation_settings_v1';
  const OLD='audio_vocab_sprint_confusable_pause_ms';
  const DEFAULTS={repeatEnabled:false,repeatCount:3,intervalMs:700};
  function clamp(n,min,max,fallback){return Number.isFinite(Number(n))&&String(n).trim()!==''?Math.max(min,Math.min(max,Math.round(Number(n)))):fallback;}
  function read(){
    let data={};try{data=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){}
    let old=null;try{old=localStorage.getItem(OLD);}catch(_){}
    const intervalMs=Object.hasOwn(data,'intervalMs')?data.intervalMs:(old===null?700:old);
    return {repeatEnabled:data.repeatEnabled===true,repeatCount:clamp(data.repeatCount,1,10,3),intervalMs:clamp(intervalMs,0,5000,700)};
  }
  function save(input){const data={repeatEnabled:input.repeatEnabled===true,repeatCount:clamp(input.repeatCount,1,10,3),intervalMs:clamp(input.intervalMs,0,5000,700)};localStorage.setItem(KEY,JSON.stringify(data));return data;}
  let token=0;
  function stop(){token++;try{speechSynthesis.cancel();}catch(_){}}
  function speak(word,voice){
    stop();const run=token,settings=read(),total=settings.repeatEnabled?settings.repeatCount:1;
    let index=0;
    function next(){if(run!==token||index>=total)return;
      const u=new SpeechSynthesisUtterance(word);u.lang=(voice&&voice.lang)||'en-US';u.rate=.86;if(voice)u.voice=voice;
      let finished=false;
      function done(){if(finished||run!==token)return;finished=true;index++;if(index<total)setTimeout(next,settings.intervalMs);}
      u.onend=done;u.onerror=done;
      try{speechSynthesis.speak(u);}catch(_){done();}
    }
    next();
  }
  g.avsPronunciation={read,save,speak,stop,intervalMs:()=>read().intervalMs};
})(window);
