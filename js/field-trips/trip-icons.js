(() => {
 const transportPlans=[
  {key:'bus',emoji:'🚌',label:'School bus',match:/school bus|district bus/i},
  {key:'van',emoji:'🚐',label:'District van',match:/district van/i},
  {key:'commercial',emoji:'🚍',label:'Commercial transportation',match:/commercial|charter/i},
  {key:'private',emoji:'🚗',label:'Private vehicle',match:/private vehicle/i},
  {key:'parent',emoji:'🚙',label:'Parent pick-up / drop-off',match:/parent.*(?:pick|drop)|^no:/i}
 ];
 const foods={tbd:{key:'tbd',emoji:'❓'},asb:{key:'provided',emoji:'🍽️'},district:{key:'provided',emoji:'🍽️'},venue:{key:'venue',emoji:'🍴'},bring:{key:'bring',emoji:'🥪'},purchase:{key:'purchase',emoji:'💳'},none:{key:'none',emoji:'🚫'},other:{key:'other',emoji:'📝'}};
 function transportation(value){const matches=transportPlans.filter(p=>p.match.test(String(value||''))).map(({key,emoji,label})=>({key,emoji,label}));return matches.length?matches:[{key:'unknown',emoji:'🧭',label:String(value||'Transportation to be confirmed')}];}
 function food(choice,text=''){
  let plan=foods[choice];
  if(!plan){if(/no meal|does not require food/i.test(text))plan=foods.none;else if(/bring|packed lunch/i.test(text))plan=foods.bring;else if(/purchase|buy your/i.test(text))plan=foods.purchase;else if(/venue/i.test(text))plan=foods.venue;else if(/provided/i.test(text))plan=foods.district;else plan=foods.tbd;}
  if(['none','tbd'].includes(plan.key))return {...plan};
  if(/\bpizza\b/i.test(text))return {key:'pizza',emoji:'🍕'};
  if(/\b(?:snack|fruit)\b/i.test(text))return {key:'snack',emoji:'🍎'};
  return {...plan};
 }
 window.NestTripIcons={transportation,food,transportPlans:transportPlans.map(({key,emoji,label})=>({key,emoji,label})),foodPlans:foods};
})();
