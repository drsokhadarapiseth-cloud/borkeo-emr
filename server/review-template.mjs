import fs from 'node:fs';import path from 'node:path';
// Only application-owned styles are embedded; no peer-supplied CSS or scripts.
export function reviewTemplate(config){
 const files=['design-system.css','components.css','patient-banner.css','soap-note.css','clinical-data.css','clinical-fees.css','interface-theme.css','khmer-fonts.css','ipd-record.css'];
 const css=files.map(file=>fs.readFileSync(path.join(config.publicDirectory,file),'utf8')).join('\n').replace(/<\/style/gi,'<\\/style');
 return fs.readFileSync(path.join(config.protectedDirectory,'EMR.html'),'utf8').replace('</head>','<style data-review-shared-styles>'+css+'</style></head>');
}
