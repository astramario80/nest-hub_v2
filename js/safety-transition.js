(()=>{
 const form=document.getElementById('safety-transition-form'),editor=document.getElementById('safety-transition-editor'),input=document.getElementById('safety-transition-minutes'),status=document.getElementById('safety-transition-status');let scope='',dirty=false;
 if(!form)return;
 function publish(values){window.NestSafetyClockSettings=values||{};document.dispatchEvent(new CustomEvent('nest-safety-clock-settings',{detail:window.NestSafetyClockSettings}));}
 function clear(){scope='';dirty=false;editor.hidden=true;form.reset();status.textContent='';publish({});}
 function render(data,catalog=window.NestSafetyCatalog){publish(data.flightTransitions);const next=(data.period||'')+'|'+(data.today||'');if(scope!==next){scope=next;dirty=false;status.textContent='';}editor.hidden=document.body.dataset.safetyPage!=='flight'||!data.canManage||!catalog?.dronePeriods?.includes(data.period);if(!dirty)input.value=data.flightTransitions?.[data.period]?.minutes??10;}
 form.addEventListener('input',()=>{dirty=true;status.textContent='Unpublished changes';});
 form.addEventListener('submit',async event=>{event.preventDefault();if(!form.reportValidity())return;const minutes=Number(input.value);if(await window.NestSafetyAction('flight-transition',{transitionMinutes:minutes})){dirty=false;status.textContent='Updated for today’s drone period.';}});
 window.NestFlightTransition={render,clear};
})();
