'use strict';
(async function(){
  const oldKh='មន្ទីរពេទ្យបង្អែក បរកែវ',oldEn='Borkeo Referral Hospital';
  const esc=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  try{
    const response=await fetch('/api/organization/branding',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)return;
    const branding=await response.json();window.organizationBranding=branding;
    const names=[[oldKh,String(branding.nameKh||oldKh)],[oldEn,String(branding.nameEn||oldEn)]];
    function textNode(node){
      if(node.parentElement?.closest('.emr-unified-brand'))return;
      let value=node.nodeValue;
      for(const [oldName,newName] of names)if(oldName!==newName)value=value.split(oldName).join(newName);
      if(value!==node.nodeValue)node.nodeValue=value;
    }
    function applyLogo(image){
      const source=image.getAttribute('src')||'';
      if(!/(?:\/public\/logo-hospital\.jpg|\/emr-assets\/LOGO-HOSPITAL\.jpg)(?:\?|$)/i.test(source))return;
      const target=`/api/organization/logo?v=${encodeURIComponent(branding.updatedAt||0)}`;
      if(source!==target)image.setAttribute('src',target);
      image.setAttribute('alt',branding.nameEn||branding.nameKh||oldEn);
    }
    function scan(root){
      if(!root)return;
      if(root.nodeType===Node.TEXT_NODE){textNode(root);return}
      if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
      if(root.nodeType===Node.ELEMENT_NODE&&root.matches('img'))applyLogo(root);
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())textNode(walker.currentNode);
      root.querySelectorAll?.('img').forEach(applyLogo);
    }
    scan(document.body);
    document.title=names.reduce((title,[oldName,newName])=>title.split(oldName).join(newName),document.title);
    if(document.body){
      const observer=new MutationObserver(records=>records.forEach(record=>{
        if(record.type==='characterData')textNode(record.target);
        else record.addedNodes.forEach(scan);
      }));
      observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    }
  }catch{}
})();
