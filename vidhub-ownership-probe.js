// Independent bounded store qualification. No traffic API, kill, or production keys.
(function(){'use strict';
 let ended=false,start=null,ops=[];
 function done(reason){if(!ended){ended=true;console.log('VIDHUB_OWNERSHIP_PROBE '+JSON.stringify({reason}));$done();}}
 try{
  const b=JSON.parse(decodeURIComponent($argument));
  if(b.enabled!==true){done('disabled');return;}
  if(Object.keys(b).sort().join()!=='enabled,expectedBuild,expectedModel,notBeforeMs,role,runId'||
    !/^[a-z0-9-]{16,80}$/.test(b.runId)||!['a','b','read'].includes(b.role)||
    !Number.isSafeInteger(b.notBeforeMs)||$environment.system!=='tvOS'||
    String($environment['surge-build'])!==b.expectedBuild||$environment['device-model']!==b.expectedModel||
    $script.name!=='vidhub-ownership-'+b.role)throw Error();
  if(b.role==='read'){
   if($script.type!=='generic')throw Error();
   const reports=[];
   for(let i=0;i<12;i++)for(const role of ['a','b']){
    const raw=$persistentStore.read('vidhub-own-probe-'+b.runId+'-r'+i+'-'+role);
    if(raw!==null){if(raw.length>8192)throw Error();reports.push(JSON.parse(raw));}
   }
   console.log('VIDHUB_OWNERSHIP_REPORT '+JSON.stringify({runId:b.runId,reports}));done('exported');return;
  }
  if($script.type!=='cron'||typeof $trigger!=='undefined'||$cronexp!=='*/10 * * * * *')throw Error();
  start=Date.now();const round=Math.floor((start-b.notBeforeMs)/10000);
  if(round<0||round>=12||start-b.notBeforeMs-round*10000>1500){done('outside_round');return;}
  const prefix='vidhub-own-probe-'+b.runId+'-r'+round,report=prefix+'-'+b.role;
  if($persistentStore.read(report)!==null){done('duplicate_role');return;}
  const id=b.role+'-'+$script.sessionID;let step=0,winner=false;
  function finish(){
   const result={version:1,runId:b.runId,round,role:b.role,sessionId:$script.sessionID,startMs:start,endMs:Date.now(),winner,ops};
   if($persistentStore.write(JSON.stringify(result),report)!==true){done('report_write_failed');return;}done('complete');
  }
  function next(){
   if(ended)return;
   try{
    if(Date.now()<start||Date.now()-start>2000){done('probe_clock_or_timeout');return;}
    let value;
    if(step===0){if($persistentStore.write(id,prefix+'-race')!==true)throw Error();}
    if(step===1){value=$persistentStore.read(prefix+'-door');if(value!==null){ops.push([Date.now(),step,value]);finish();return;}}
    if(step===2){if($persistentStore.write('closed',prefix+'-door')!==true)throw Error();}
    if(step===3){value=$persistentStore.read(prefix+'-race');winner=value===id;}
    ops.push([Date.now(),step,value===undefined?null:value]);step++;
    if(step===4){finish();return;}
    setTimeout(next,10+((round+(b.role==='a'?step:3-step))%3)*10);
   }catch(_){done('store_operation_failed');}
  }
  next();
 }catch(_){done('invalid_probe_configuration');}
}());
