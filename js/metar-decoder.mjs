// Category structure and abbreviation glossary adapted from the existing METAR LookUp bound script.
const abbreviations = {
    'METAR': 'Routine weather report',
    'SPECI': 'Special weather report',
    'AUTO': 'Fully automated report',
    'COR': 'Correction to a previously disseminated observation',
    'KT': 'knots',
    'MPS': 'meters per second',
    'SM': 'statute miles',
    'M': 'meters',
    'KM': 'kilometers',
    'CLR': 'Clear sky',
    'FEW': 'Few clouds at',
    'SCT': 'Scattered clouds at',
    'BKN': 'Broken clouds at',
    'OVC': 'Overcast clouds at',
    'CAVOK': 'Ceiling and visibility OK',
    'DZ': 'Drizzle',
    'RA': 'Rain',
    'SN': 'Snow',
    'SG': 'Snow grains',
    'IC': 'Ice crystals',
    'PL': 'Ice pellets',
    'GR': 'Hail',
    'GS': 'Small hail',
    'UP': 'Unknown precipitation',
    'BR': 'Mist',
    'FG': 'Fog',
    'FU': 'Smoke',
    'VA': 'Volcanic ash',
    'DU': 'Dust',
    'SA': 'Sand',
    'HZ': 'Haze',
    'PY': 'Spray',
    'PO': 'Dust/sand whirls',
    'SQ': 'Squall',
    'FC': 'Funnel cloud',
    'SS': 'Sandstorm',
    'DS': 'Duststorm',
    'VC': 'In the vicinity',
    'MI': 'Shallow',
    'PR': 'Partial',
    'BC': 'Patches',
    'DR': 'Low drifting',
    'BL': 'Blowing',
    'SH': 'Showers',
    'TS': 'Thunderstorm',
    'FZ': 'Freezing',
    'NSC': 'No significant clouds',
    'SKC': 'Sky clear',
    'QNH': 'Altimeter setting (QNH)',
    'A': 'inHg',
    'Q': 'hPa',
    '$': 'Maintenance needed on the system',
    '+': 'Heavy intensity',
    '-': 'Light intensity',
    'ACC': 'Altocumulus castellanus',
    'ACFT MSHP': 'Aircraft mishap',
    'ACSL': 'Altocumulus standing lenticular cloud',
    'AO1': 'Automated station without precipitation discriminator',
    'AO2': 'Automated station with precipitation discriminator',
    'ALP': 'Airport location point',
    'APCH': 'Approach',
    'APRNT': 'Apparent',
    'APRX': 'Approximately',
    'ATCT': 'Airport traffic control tower',
    'B': 'Began',
    'CC': 'Cirrocumulus',
    'CCSL': 'Standing lenticular cirrocumulus',
    'CG': 'Cloud-ground lightning',
    'CHI': 'Cloud-height indicator',
    'CHINO': 'Sky condition at secondary location not available',
    'CIG': 'Ceiling',
    'CONS': 'Continuous',
    'DOC': 'Department of Commerce',
    'DOD': 'Department of Defense',
    'DOT': 'Department of Transportation',
    'DSNT': 'Distant',
    'DVR': 'Dispatch visual range',
    'E': 'East, ended, estimated ceiling (SAO)',
    'FAA': 'Federal Aviation Administration',
    'FC': 'Funnel cloud',
    'FG': 'Fog',
    'FIBI': 'Filed but impracticable to transmit',
    'FIRST': 'First observation after a break in coverage at manual station',
    'FRQ': 'Frequent',
    'FROPA': 'Frontal passage',
    'FU': 'Smoke',
    'GR': 'Hail',
    'GS': 'Small hail and/or snow pellets',
    'HLSTO': 'Hailstone',
    'HZ': 'Haze',
    'IC': 'Ice crystals, in-cloud lightning',
    'INCRG': 'Increasing',
    'INTMT': 'Intermittent',
    'KT': 'KNOTS',
    'L': 'Left (with reference to runway designation)',
    'LAST': 'Last observation before a break in coverage at a manual station',
    'LST': 'Local Standard Time',
    'LTG': 'Lightning',
    'LWR': 'Lower',
    'M': 'Minus, less than',
    'max': 'Maximum',
    'METAR': 'Routine weather report provided at fixed intervals',
    'MI': 'Shallow',
    'min': 'Minimum',
    'MOV': 'Moved/moving/movement',
    'MT': 'Mountains',
    'N': 'North',
    'N/A': 'Not applicable',
    'NCDC': 'National Climatic Data Center',
    'NE': 'Northeast',
    'NOS': 'National Ocean Survey',
    'NOSPECI': 'No SPECI reports are taken at the station',
    'NOTAM': 'Notice to Airmen',
    'NW': 'Northwest',
    'NWS': 'National Weather Service',
    'OCNL': 'Occasional',
    'OFCM': 'Office of the Federal Coordinator for Meteorology',
    'OHD': 'Overhead',
    'OVC': 'Overcast',
    'OVR': 'Over',
    'P': 'Indicates greater than the highest reportable value',
    'PCPN': 'Precipitation',
    'PL': 'Ice pellets',
    'PK WND': 'Peak wind',
    'PNO': 'Precipitation amount not available',
    'PO': 'Dust/sand whirls (dust devils)',
    'PRES': 'Pressure',
    'PR': 'Partial',
    'PRESFR': 'Pressure falling rapidly',
    'PRESRR': 'Pressure rising rapidly',
    'PWINO': 'Precipitation identifier sensor not available',
    'PY': 'Spray',
    'R': 'Right (with reference to runway designation), runway',
    'RA': 'Rain',
    'RTD': 'Routine delayed (late) observation',
    'RV': 'Reportable value',
    'RVR': 'Runway visual range',
    'RVRNO': 'RVR system values not available',
    'RY': 'Runway',
    'S': 'Snow, south',
    'SA': 'Sand',
    'SCSL': 'Stratocumulus standing lenticular cloud',
    'SCT': 'Scattered',
    'SE': 'Southeast',
    'SFC': 'Surface',
    'SG': 'Snow grains',
    'SH': 'Shower(s)',
    'SKC': 'Sky clear',
    'SLP': 'Sea-level pressure',
    'SLPNO': 'Sea-level pressure not available',
    'SM': 'Statute miles',
    'SN': 'Snow',
    'SNINCR': 'Snow increasing rapidly',
    'SP': 'Snow pellets',
    'SPECI': 'An unscheduled report taken when certain criteria have been met',
    'SQ': 'Squalls',
    'SS': 'Sandstorm',
    'STN': 'Station',
    'SW': 'Snow shower, southwest',
    'TCU': 'Towering cumulus',
    'TS': 'Thunderstorm',
    'TSNO': 'Thunderstorm information not available',
    'TWR': 'Tower',
    'UNKN': 'Unknown',
    'UP': 'Unknown precipitation',
    'UTC': 'Coordinated Universal Time',
    'V': 'Variable',
    'VA': 'Volcanic ash',
    'VC': 'In the vicinity',
    'VV': 'Vertical visibility',
    'W': 'West',
    'WSHFT': 'Wind shift',
    'Z': 'Zulu, i.e., Coordinated Universal Time',
    '9999': '10 kilometers or more',
    'NOSIG': 'No significant changes in weather conditions expected'
  };
export const categories=[['stationID','Station ID','#800080'],['observationTime','Observation Time','#cf7070'],['modifier','Modifier','#f5c04e'],['wind','Wind','#4e6ff5'],['visibility','Visibility','#70cacf'],['weather','Weather','#969363'],['skyCondition','Sky Condition','#008000'],['temperatureDewPoint','Temperature and Dew Point','#A52A2A'],['altimeter','Altimeter Setting','#76cf70'],['remarks','Remarks','#808080']];
const weatherCodes={MI:'Shallow',BC:'Patches of',PR:'Partial',DR:'Low drifting',BL:'Blowing',SH:'Showers of',TS:'Thunderstorm',FZ:'Freezing',DZ:'drizzle',RA:'rain',SN:'snow',SG:'snow grains',IC:'ice crystals',PL:'ice pellets',GR:'hail',GS:'small hail or snow pellets',UP:'unknown precipitation',BR:'mist',FG:'fog',FU:'smoke',VA:'volcanic ash',DU:'dust',SA:'sand',HZ:'haze',PY:'spray',PO:'dust or sand whirls',SQ:'squalls',FC:'funnel cloud',SS:'sandstorm',DS:'duststorm'};
export function decodeWeather(token){let text='',body=token;if(/^[+-]/.test(body)){text=body[0]==='+'?'Heavy ':'Light ';body=body.slice(1);}if(body.startsWith('VC')){text+='In the vicinity: ';body=body.slice(2);}if(!body||body.length%2)return null;const parts=body.match(/../g);if(!parts.every(p=>weatherCodes[p]))return null;return text+parts.map(p=>weatherCodes[p]).join(' ');}
export function observationDate(token,reference=new Date()){
 if(!/^\d{6}Z$/.test(token))return null;const day=+token.slice(0,2),hour=+token.slice(2,4),minute=+token.slice(4,6);if(!day||day>31||hour>23||minute>59)return null;
 const ref=new Date(reference);if(!Number.isFinite(+ref))return null;const choices=[-1,0,1].map(offset=>{const first=new Date(Date.UTC(ref.getUTCFullYear(),ref.getUTCMonth()+offset,1));const date=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),day,hour,minute));return date.getUTCMonth()===first.getUTCMonth()?date:null;}).filter(Boolean).sort((a,b)=>Math.abs(a-ref)-Math.abs(b-ref));return choices[0]||null;
}
function visibility(value){if(value==='CAVOK')return 'Visibility 10 kilometers or more; ceiling and visibility OK as reported';if(value==='9999')return '10 kilometers or more';let text=value.replace(/^M/,'Less than ').replace(/^P/,'Greater than ');return text.replace(/SM$/,' statute miles').replace(/KM$/,' kilometers').replace(/M$/,' meters');}
function wind(value){const match=value.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)$/);if(!match)return value;const [,dir,speed,gust,units]=match,unit={KT:'knots',MPS:'meters per second',KMH:'kilometers per hour'}[units];if(dir==='000'&&+speed===0)return 'Calm wind';return `${dir==='VRB'?'Variable wind direction':'Wind from '+Number(dir)+'°'} at ${Number(speed)} ${unit}${gust?', gusting to '+Number(gust)+' '+unit:''}`;}
function sky(value){const m=value.match(/^(CLR|SKC|NSC|NCD|CAVOK|FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)?(CB|TCU)?$/);if(!m)return value;const cover={CLR:'Clear sky',SKC:'Sky clear',NSC:'No significant clouds',NCD:'No clouds detected',CAVOK:'Ceiling and visibility OK',FEW:'Few clouds',SCT:'Scattered clouds',BKN:'Broken clouds',OVC:'Overcast clouds',VV:'Vertical visibility'}[m[1]];return cover+(m[2]?(m[2]==='///'?' · height unavailable':` at ${Number(m[2])*100} feet above ground`):'')+(m[3]?m[3]==='CB'?' · cumulonimbus':' · towering cumulus':'');}
function remark(value){if(abbreviations[value])return abbreviations[value];let m=value.match(/^SLP(\d{3})$/);if(m){const p=+m[1];return `Sea-level pressure ${(p>=500?900:1000)+p/10} hPa`;}
 m=value.match(/^T([01])(\d{3})([01])(\d{3})$/);if(m)return `Hourly temperature ${(+m[2]/10)*(m[1]==='1'?-1:1)}°C; dew point ${(+m[4]/10)*(m[3]==='1'?-1:1)}°C`;return value;}
export function decodeMetar(input,{observedAt,reference=new Date()}={}){
 if(typeof input!=='string'||input.length>4000)throw Error('Paste a METAR report of up to 4,000 characters.');
 const raw=input.trim().replace(/\s+/g,' ').replace(/=$/,'').toUpperCase(),parts=raw.split(' '),values=Object.fromEntries(categories.map(([key])=>[key,[]])),tokens=[],other=[];
 const add=(key,token)=>{values[key].push(token);tokens.push({key,text:token});};
 let i=0;if(['METAR','SPECI'].includes(parts[i])){tokens.push({key:null,text:parts[i++]});}if(parts[i]==='COR')add('modifier',parts[i++]);
 if(!/^[A-Z][A-Z0-9]{3}$/.test(parts[i]||'')||!/^\d{6}Z$/.test(parts[i+1]||''))throw Error('Use a METAR beginning with its station ID and observation time, such as KPLU 041635Z.');
 add('stationID',parts[i++]);add('observationTime',parts[i++]);
 for(;i<parts.length;i++){
  const p=parts[i];if(p==='RMK'||p==='NOSIG'){for(;i<parts.length;i++)add('remarks',parts[i]);break;}
  if(/^(AUTO|COR)$/.test(p))add('modifier',p);
  else if(/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?(KT|MPS|KMH)$/.test(p)||/^\d{3}V\d{3}$/.test(p))add('wind',p);
  else if(/^\d+$/.test(p)&&/^\d+\/\d+SM$/.test(parts[i+1]||''))add('visibility',p+' '+parts[++i]);
  else if(/^[MP]?(\d+(\/\d+)?SM|\d{4}|\d+(KM|M))$/.test(p)||p==='CAVOK')add('visibility',p);
  else if(/^(CLR|SKC|NSC|NCD|FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)?(CB|TCU)?$/.test(p))add('skyCondition',p);
  else if(/^(M?\d{2}|\/\/)\/(M?\d{2}|\/\/)?$/.test(p))add('temperatureDewPoint',p);
  else if(/^[AQ]\d{4}$/.test(p))add('altimeter',p);
  else if(decodeWeather(p))add('weather',p);else {other.push(p);tokens.push({key:null,text:p});}
 }
 const obs=observedAt?new Date(observedAt):observationDate(values.observationTime[0],reference);if(!obs||!Number.isFinite(+obs))throw Error('The observation time could not be decoded.');
 const rows=categories.map(([key,label,color])=>{const group=values[key],code=group.join(' ');let decoded='Not reported';
  if(group.length){
   if(key==='stationID')decoded=code;
   if(key==='observationTime')decoded=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',dateStyle:'medium',timeStyle:'short'}).format(obs)+' Pacific · '+obs.toISOString().replace('T',' ').replace('.000Z',' UTC');
   if(key==='modifier')decoded=group.map(v=>abbreviations[v]||v).join('; ');
   if(key==='wind')decoded=group.map(v=>/^\d{3}V\d{3}$/.test(v)?'Direction varies from '+Number(v.slice(0,3))+'° to '+Number(v.slice(4,7))+'°':wind(v)).join('; ');
   if(key==='visibility')decoded=group.map(visibility).join('; ');
   if(key==='weather')decoded=group.map(decodeWeather).join('; ');
   if(key==='skyCondition')decoded=group.map(sky).join('; ');
   if(key==='temperatureDewPoint'){const [t,d]=code.split('/');decoded='Temperature '+(t?t.replace('M','-')+'°C':'unavailable')+'; dew point '+(d?d.replace('M','-')+'°C':'unavailable');}
   if(key==='altimeter')decoded=group.map(v=>v[0]==='A'?'Altimeter '+(Number(v.slice(1))/100).toFixed(2)+' inches Hg':'Altimeter '+v.slice(1)+' hPa').join('; ');
   if(key==='remarks')decoded=group.filter(v=>v!=='RMK').map(remark).join('; ');
  }return {key,label,color,code,decoded};});
 return {raw,station:values.stationID[0],observedAt:obs.toISOString(),tokens,rows,other};
}
