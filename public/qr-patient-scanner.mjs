// Patient cards contain a plain Health ID, never a navigation instruction.
export function patientIdFromQr(raw){
 if(typeof raw!=='string'||raw.length>120)return null;
 const value=raw.replace(/^\uFEFF/,'').trim();
 return /^[A-Za-z0-9\u17e0-\u17e9][A-Za-z0-9\u17e0-\u17e9 ._:-]{2,119}$/.test(value)&&!value.includes('://')?value:null;
}
export function startQrCamera({video,onCode,onError}){
 let active=true,stream,timer;const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
 const stop=()=>{active=false;clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;canvas.width=canvas.height=0};
 void(async()=>{
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('secure');
   await import('/public/vendor/jsQR-1.4.0.js');if(!active)return;
   stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
   if(!active){stream.getTracks().forEach(track=>track.stop());return}
   video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();if(!active)return;
   const tick=()=>{if(!active)return;try{if(video.readyState>=2&&video.videoWidth){const scale=Math.min(1,640/video.videoWidth,640/video.videoHeight);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);context.drawImage(video,0,0,canvas.width,canvas.height);const pixels=context.getImageData(0,0,canvas.width,canvas.height),code=window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});if(code){stop();onCode(code.data);return}}timer=setTimeout(tick,200)}catch(error){stop();onError(error)}};tick();
  }catch(error){const notify=active;stop();if(notify)onError(error)}
 })();return stop;
}
