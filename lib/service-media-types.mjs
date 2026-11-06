export const MAX_FILE_SIZE=100*1024*1024,MAX_FILES=5,MAX_TOTAL_SIZE=250*1024*1024;
export const MEDIA_TYPES=Object.freeze({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','image/heic':'heic','image/heif':'heif','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','video/mpeg':'mpeg','video/3gpp':'3gp','video/x-m4v':'m4v'});
export const mediaId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export function mediaFields(value){
 if(!value||!mediaId(value.ticketId)||!mediaId(value.fileId)||typeof value.name!=='string'||!value.name.trim()||value.name.length>180||/[\u0000-\u001f\u007f]/.test(value.name)||!Object.hasOwn(MEDIA_TYPES,value.type)||!Number.isSafeInteger(value.size)||value.size<=0||value.size>MAX_FILE_SIZE)return null;
 if(value.context!==undefined&&!['ticket','internal','public'].includes(value.context))return null;if(value.context&&value.context!=='ticket'&&!mediaId(value.entryId))return null;
 if(value.storage!==undefined&&value.storage!=='drive')return null;if(value.storage==='drive'&&(typeof value.driveId!=='string'||!/^[-_a-zA-Z0-9]{10,200}$/.test(value.driveId)))return null;
 return {ticketId:value.ticketId,fileId:value.fileId,name:value.name.trim(),type:value.type,size:value.size,...(value.storage==='drive'?{storage:'drive',driveId:value.driveId,driveUrl:'https://drive.google.com/file/d/'+value.driveId+'/view'}:{}),...(value.context?{context:value.context,...(value.entryId?{entryId:value.entryId}:{})}:{}),path:'service-media/'+value.ticketId+'/'+value.fileId+'.'+MEDIA_TYPES[value.type]};
}
