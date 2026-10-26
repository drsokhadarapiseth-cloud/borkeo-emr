import http from 'node:http';
export async function startNpcaMock(){
  const state={tokens:0,refreshes:0,searches:0,submissions:[],polls:0,requests:[],expiredOnce:false,alwaysUnauthorized:false,offline:false,failNext:0,finalStatus:1,failReason:'Synthetic processing failure',visits:new Map(),beneficiaries:[{spid:'MOCK-SPID',patient_code:'MOCK-PATIENT',surname:'Synthetic',name:'Patient',sex:'F',birthdate:'1990-01-01',dead:false,eligible:true,benefit_cards:[{card_type:'HEF',card_number:'MOCK-CARD'}]}]};
  const server=http.createServer(async(req,res)=>{
    if(state.offline){req.socket.destroy();return;}
    let text='';for await(const chunk of req)text+=chunk;
    const body=text?JSON.parse(text):{},url=new URL(req.url,'http://127.0.0.1');
    state.requests.push({path:url.pathname,method:req.method,body});
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    if(url.pathname==='/oauth/token'){
      state.tokens++;if(body.grant_type==='refresh_token')state.refreshes++;
      return send(200,{access_token:'MOCK-TOKEN-'+state.tokens,refresh_token:'MOCK-REFRESH-'+state.tokens,expires_in:7200,token_type:'Bearer'});
    }
    if(state.alwaysUnauthorized||state.expiredOnce){state.expiredOnce=false;return send(401,{success:false,message:'Unauthenticated',errors:'Invalid or expired token'});}
    if(!req.headers.authorization?.startsWith('Bearer MOCK-TOKEN-')||!req.headers['x-system-code']||!req.headers['x-health-facility-code'])return send(403,{success:false,message:'Access denied'});
    if(state.failNext){const status=state.failNext;state.failNext=0;return send(status,{success:false,message:status===422?'Invalid request data':'Synthetic HTTP error',errors:status===422?'The visits.0.code field is required.':'Synthetic error'});}
    if(url.pathname==='/api/v1/external/beneficiary/search'){
      state.searches++;return send(200,{success:true,data:state.beneficiaries});
    }
    if(url.pathname==='/api/v1/external/visits'&&req.method==='POST'){
      const visit=body.visits?.[0];if(!visit?.code)return send(422,{success:false,errors:'The visits.0.code field is required.'});
      state.submissions.push(body);const result={visit_code:visit.code,visit_ulid:'MOCK-ULID-'+visit.code,status:visit.discharged_at?5:3};state.visits.set(visit.code,result);return send(200,{success:true,message:'Synthetic accepted',data:result});
    }
    if(url.pathname==='/api/v1/external/visits/processed'){
      state.polls++;
      // Date-range check (PDF 4.4): every stored visit, paginated, status as text when asked.
      if(!url.searchParams.get('visit_code')&&url.searchParams.get('discharged_at_from')){
        const perPage=Number(url.searchParams.get('per_page')||100),page=Number(url.searchParams.get('page')||1),all=[...state.visits.values()],text={1:'ready',2:'failed',3:'pending',5:'processing'};
        const rows=all.slice((page-1)*perPage,page*perPage).map(v=>({...v,status:state.statusAsText?text[state.finalStatus]:state.finalStatus,errors:state.finalStatus===2?state.failReason:[]}));
        return send(200,{success:true,data:{data:rows,current_page:page,last_page:Math.max(1,Math.ceil(all.length/perPage))}});
      }
      const stored=state.visits.get(url.searchParams.get('visit_code')||body.visit_code);
      return send(200,{success:true,data:stored?[{...stored,status:state.finalStatus,errors:state.finalStatus===2?state.failReason:[]}]:[]});
    }
    send(404,{success:false,message:'Unknown mock endpoint'});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {state,url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
