export const PHOTO_TYPES={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export const MAX_PHOTOS=8,MAX_PHOTO_SIZE=20*1024*1024,MAX_PHOTO_TOTAL=80*1024*1024;
export const PHOTO_PATH=/^safety-media\/[a-f0-9-]{36}\.(jpg|png|webp)$/;
export function photoSelection(files){const chosen=[...files];if(!chosen.length||chosen.length>MAX_PHOTOS||chosen.reduce((n,f)=>n+f.size,0)>MAX_PHOTO_TOTAL)throw Error('Choose 1–8 photos, totaling up to 80 MB.');for(const f of chosen)if(!Object.hasOwn(PHOTO_TYPES,f.type)||!Number.isSafeInteger(f.size)||f.size<1||f.size>MAX_PHOTO_SIZE)throw Error('Choose JPG, PNG, or WebP photos up to 20 MB each.');return chosen;}
export async function photoJSON(storage,path){const value=await storage.get(path,{access:'private',useCache:false});return value?new Response(value.stream).json():null;}
