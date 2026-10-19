const DEFAULT_NAME_KH='មន្ទីរពេទ្យបង្អែក បរកែវ';
const DEFAULT_NAME_EN='Borkeo Referral Hospital';
const MAX_LOGO_BYTES=2*1024*1024;

export function ensureOrganizationBrandingSchema(database){
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS organization_branding (
    id TEXT PRIMARY KEY CHECK(id='default'),
    name_kh TEXT NOT NULL,
    name_en TEXT NOT NULL,
    logo_mime TEXT NOT NULL DEFAULT '',
    logo_data BLOB,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at INTEGER NOT NULL
  ) STRICT;`);
}

export function getOrganizationBranding(database){
  const row=database.sqlite.prepare("SELECT name_kh,name_en,logo_mime,updated_at FROM organization_branding WHERE id='default'").get();
  return {nameKh:row?.name_kh||DEFAULT_NAME_KH,nameEn:row?.name_en||DEFAULT_NAME_EN,
    hasCustomLogo:Boolean(row?.logo_mime),updatedAt:Number(row?.updated_at||0)};
}

export function getOrganizationLogo(database){
  return database.sqlite.prepare("SELECT logo_mime AS mime,logo_data AS data,updated_at AS updatedAt FROM organization_branding WHERE id='default' AND logo_mime<>'' AND logo_data IS NOT NULL").get()||null;
}

function decodeLogo(value){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string')throw new Error('Choose a PNG, JPEG or WebP image.');
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match)throw new Error('Choose a PNG, JPEG or WebP image.');
  const data=Buffer.from(match[2],'base64');
  if(!data.length||data.length>MAX_LOGO_BYTES)throw new Error('The logo must be smaller than 2 MB.');
  const valid=match[1]==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    match[1]==='image/jpeg'?data[0]===0xff&&data[1]===0xd8&&data[2]===0xff:
      data.subarray(0,4).toString('ascii')==='RIFF'&&data.subarray(8,12).toString('ascii')==='WEBP';
  if(!valid)throw new Error('The image data does not match its file type.');
  return {mime:match[1],data};
}

export function updateOrganizationBranding(database,values,userId,now=Date.now()){
  const nameKh=String(values?.nameKh||'').trim();
  const nameEn=String(values?.nameEn||'').trim();
  if(!nameKh||nameKh.length>180||/[\u0000-\u001f\u007f]/.test(nameKh))throw new Error('Enter a valid facility name in Khmer (up to 180 characters).');
  if(!nameEn||nameEn.length>180||/[\u0000-\u001f\u007f]/.test(nameEn))throw new Error('Enter a valid facility name in English (up to 180 characters).');
  const logo=values?.removeLogo===true?{mime:'',data:null}:decodeLogo(values?.logoDataUrl);
  const current=getOrganizationLogo(database);
  const logoMime=logo?.mime??current?.mime??'';
  const logoData=logo?.data??(values?.removeLogo===true?null:current?.data??null);
  database.sqlite.prepare(`INSERT INTO organization_branding(id,name_kh,name_en,logo_mime,logo_data,updated_by,updated_at)
    VALUES('default',?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name_kh=excluded.name_kh,name_en=excluded.name_en,
    logo_mime=excluded.logo_mime,logo_data=excluded.logo_data,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
    .run(nameKh,nameEn,logoMime,logoData,userId,now);
  return getOrganizationBranding(database);
}
