/** Deterministic wallet/RPC fixtures. Nothing here signs or broadcasts to a network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { parseAbi, decodeFunctionData, encodeFunctionResult, toHex, parseEther, encodeEventTopics, encodeAbiParameters, encodeFunctionData } from 'viem';

const C={core:'0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44',token:'0x5501e1fa81be1c3f49225fa7668da0245d07db60',nft:'0xcb98349c134ab983da5bfd80527dfe2552bdb70f',mining:'0xcd46990f8349057335289ef282c276204b6cdc62',staking:'0x4b67b739dfd832f4eac67a7aa3bc244fb74cea4f'};
// Public addresses are used only as identities in a simulated wallet, with no key material.
const ACCOUNT='0x31bb410adf99297913b38d60fa29f52897b08993';
const RECIPIENT='0x3c4c2ba9a5dfbfc5e48dceabdd3b004131a04be6';
const Z='0x0000000000000000000000000000000000000000';
const abis={
 core:parseAbi(['function state() view returns ((uint64 settledThroughRound,uint64 cumulativeWork,uint96 cumulativeBlockUnits,uint64 blockHeight,uint96 blockProgress,uint32 workPerThousandBlocks,uint256 authorizationNonce,bool paused))']),
 mining:parseAbi(['function state() view returns ((uint256 minted,uint256 gachaFunded,uint256 stakingFunded,uint64 processedThroughRound,uint64 startRound,uint64 startHeight,uint64 fundedBlocks,address guardian,bool bootstrapped,bool startCaptured,bool paused,bool active))','function checkpointStatus() view returns (bool corePaused,uint64 nextRound,bool roundSettled)','function checkpoint()']),
 staking:parseAbi(['function paused() view returns (bool)','function launchReady() view returns (bool)','function MAX_TOKENS() view returns (uint256)','function accountPower(address) view returns (uint256,uint256)','function claimable(address) view returns (uint256)','function claimRecipient(address) view returns (address)','function stakeOf(address) view returns (uint256,uint256,uint64)','function depositor(address,uint256) view returns (address)','function deposit(address,uint256[])','function claim(address) returns (uint256)','function claimAndStake() returns (uint256)','function stake(uint256)']),
 nft:parseAbi(['function balanceOf(address) view returns (uint256)','function ownerOf(uint256) view returns (address)','function level(uint256) view returns (uint8)','function isApprovedForAll(address,address) view returns (bool)','function setApprovalForAll(address,bool)']),
 token:parseAbi(['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)','function decimals() view returns (uint8)']),
 multicall:parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[])']),
};
const checkpointEvent=parseAbi(['event Checkpointed(uint64 indexed throughRound,uint64 fundedBlocks,uint256 amount)'])[0];
const transferEvent=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)'])[0];
const H1='0x'+'1'.repeat(64),H2='0x'+'2'.repeat(64);
function log(event,args,hash,block,index,data='0x') {return {address:event.name==='Transfer'?C.nft:C.mining,topics:encodeEventTopics({abi:[event],eventName:event.name,args}),data,transactionHash:hash,blockNumber:toHex(block),blockHash:'0x'+'a'.repeat(64),logIndex:toHex(index),transactionIndex:'0x0',removed:false}}
const checkpointData=encodeAbiParameters([{type:'uint64'},{type:'uint256'}],[5163n,0n]);
const history=[log(checkpointEvent,{throughRound:669n},H1,12031800n,0,checkpointData),log(checkpointEvent,{throughRound:670n},H1,12031800n,1,checkpointData),log(checkpointEvent,{throughRound:671n},H2,12031801n,2,checkpointData)];
const incoming=log(transferEvent,{from:Z,to:ACCOUNT,tokenId:8935n},H1,12031800n,0);
const roots=path.resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{try{let name=decodeURIComponent(req.url.split('?')[0]).replace(/^\/preview\//,'');if(!name)name='index.html';const file=path.resolve(roots,name);if(!file.startsWith(roots+path.sep))throw Error();res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/preview/`;
const browser=await chromium.launch({headless:true});
const results=[];
let current;
function initial(overrides={}){return {pending:3n,nftApproved:false,allowance:0n,sqk:parseEther('100'),claimable:parseEther('10'),deposited:false,paused:false,empty:false,sends:[],reject:false,failSimulation:false,receipt:'success',history:false,pruned:false,apiDown:false,noWallet:false,rpm:73250,eventRequests:0,...overrides}}
function contractCall(state,to,data){
 const key=Object.keys(C).find(key=>C[key]===to.toLowerCase());
 if(!key){const call=decodeFunctionData({abi:abis.multicall,data});return encodeFunctionResult({abi:abis.multicall,functionName:'aggregate3',result:call.args[0].map(c=>({success:true,returnData:contractCall(state,c.target,c.callData)}))})}
 const abi=abis[key];const call=decodeFunctionData({abi,data});const fn=call.functionName;let result;
 switch(fn){
 case 'state':result=key==='core'?[672n,58050n,5163085514488n,5163n,85514488n,11267,627n,false]:[parseEther('20000000'),0n,0n,672n-state.pending,13n,0n,5163n,RECIPIENT,true,true,false,true];break;
 case 'checkpointStatus':result=[false,673n-state.pending,state.pending>0n];break;
 case 'paused':result=state.paused;break;
 case 'launchReady':result=true;break;
 case 'MAX_TOKENS':result=100n;break;
 case 'accountPower':result=[state.empty?0n:parseEther('1000'),parseEther('25')];break;
 case 'claimable':result=state.claimable;break;
 case 'claimRecipient':result=RECIPIENT;break;
 case 'stakeOf':result=[parseEther('5'),0n,0n];break;
 case 'depositor':result=ACCOUNT;break;
 case 'ownerOf':result=state.deposited?C.staking:ACCOUNT;break;
 case 'level':result=1;break;
 case 'balanceOf':result=key==='token'?state.sqk:state.empty?0n:state.deposited?0n:1n;break;
 case 'allowance':result=state.allowance;break;
 case 'isApprovedForAll':result=state.nftApproved;break;
 case 'decimals':result=18;break;
 default:if(state.failSimulation)throw Error('execution reverted');result=fn==='approve'?true:['claim','claimAndStake'].includes(fn)?state.claimable:undefined;
 }
 return encodeFunctionResult({abi,functionName:fn,result});
}
function receipt(hash,state){return {transactionHash:hash,transactionIndex:'0x0',blockHash:'0x'+'a'.repeat(64),blockNumber:'0xb79760',from:ACCOUNT,to:state.sends.find(x=>x.hash===hash)?.to??C.token,cumulativeGasUsed:'0x5208',gasUsed:'0x5208',contractAddress:null,logs:[],logsBloom:'0x'+'0'.repeat(512),status:state.receipt==='success'?'0x1':'0x0',effectiveGasPrice:'0x3b9aca00',type:'0x2'}}
async function setup(overrides={},mobile=false){
 const state=initial(overrides);const context=await browser.newContext({viewport:{width:mobile?390:1440,height:mobile?844:1000},isMobile:mobile,hasTouch:mobile,...(overrides.noWallet?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1'}:{})});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('fixtureSend',async tx=>{
  if(state.reject){const e=Error('User rejected the request');e.code=4001;throw e}
  const key=Object.keys(C).find(key=>C[key]===tx.to.toLowerCase());
  const decoded=decodeFunctionData({abi:abis[key],data:tx.data});
  const hash='0x'+String(state.sends.length+1).padStart(64,'0'); // Fixture hash, never sent to a network.
  state.sends.push({...tx,hash,method:decoded.functionName,args:decoded.args});
  if(decoded.functionName==='checkpoint')state.pending=0n;
  if(decoded.functionName==='setApprovalForAll')state.nftApproved=decoded.args[1];
  if(decoded.functionName==='deposit')state.deposited=true;
  if(decoded.functionName==='approve'&&decoded.args[0].toLowerCase()===C.staking)state.allowance=decoded.args[1];
  if(decoded.functionName==='stake'){state.sqk-=decoded.args[0];state.allowance-=decoded.args[0]}
  if(['claim','claimAndStake'].includes(decoded.functionName))state.claimable=0n;
  return hash;
 });
 await context.addInitScript(({account,noWallet})=>{
  if(noWallet)return;
  const listeners={};let chain='0x1',added=false,authorized=sessionStorage.getItem('fixture-authorized')==='yes';const calls=[];window.fixtureCalls=calls;
  const emit=(name,value)=>(listeners[name]??[]).forEach(fn=>fn(value));
  const provider={on:(n,fn)=>{(listeners[n]??=[]).push(fn)},removeListener:(n,fn)=>{listeners[n]=(listeners[n]??[]).filter(x=>x!==fn)},request:async({method,params})=>{
   calls.push({method,params});
   if(method==='eth_requestAccounts'){authorized=true;sessionStorage.setItem('fixture-authorized','yes');return[account]}
   if(method==='eth_accounts')return authorized?[account]:[];
   if(method==='eth_chainId')return chain;
   if(method==='wallet_switchEthereumChain'){if(!added)throw Object.assign(Error('Unknown chain'),{code:4902});chain=params[0].chainId;emit('chainChanged',chain);return null}
   if(method==='wallet_addEthereumChain'){added=true;chain=params[0].chainId;emit('chainChanged',chain);return null}
   if(method==='eth_sendTransaction')return window.fixtureSend(params[0]);
   if(method==='eth_getTransactionCount')return'0x0';
   if(method==='wallet_getCapabilities')return{};
   throw Error('Unsupported fixture wallet method '+method);
  }};
  window.ethereum=provider;window.fixtureChangeAccount=()=>emit('accountsChanged',['0x3c4c2ba9a5dfbfc5e48dceabdd3b004131a04be6']);window.fixtureWrongChain=()=>{chain='0x1';emit('chainChanged',chain)};
  const announce=()=>dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'e7957393-a3fb-4f51-ae92-79892b587fa1',name:'Fixture Wallet',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',rdns:'test.fixture.wallet'},provider}}));
  addEventListener('eip6963:requestProvider',announce);announce();
 },{account:ACCOUNT,noWallet:state.noWallet});
 await context.route(/https:\/\/(ethereum-sepolia-rpc\.publicnode\.com|sepolia\.drpc\.org)/,async route=>{
  const handle=req=>{let result;try{
   switch(req.method){
    case 'eth_chainId':result='0xaa36a7';break;
    case 'eth_blockNumber':result='0xb79760';break;
    case 'eth_getBalance':result=toHex(parseEther('1'));break;
    case 'eth_getLogs':{
     const params=req.params[0];const address=params.address.toLowerCase();
     if(state.pruned&&address===C.mining)throw Error('pruned history unavailable');
     const candidates=address===C.mining&&state.history?history:address===C.nft&&state.apiDown&&!state.empty?[incoming]:[];
     result=candidates.filter(log=>BigInt(log.blockNumber)>=BigInt(params.fromBlock)&&BigInt(log.blockNumber)<=BigInt(params.toBlock));break;
    }
    case 'eth_getTransactionByHash':result={hash:req.params[0],from:req.params[0]===H1?ACCOUNT:RECIPIENT,to:C.mining,input:encodeFunctionData({abi:abis.mining,functionName:'checkpoint'}),blockNumber:'0xb79738',value:'0x0',type:'0x0',nonce:'0x0',gas:'0x186a0',gasPrice:'0x3b9aca00',v:'0x1b',r:'0x1',s:'0x1'};break;
    case 'eth_getBlockByNumber':result={number:req.params[0],timestamp:toHex(1793423724n+BigInt(req.params[0])%100n),transactions:[],hash:'0x'+'a'.repeat(64),parentHash:'0x'+'b'.repeat(64),gasLimit:'0x1c9c380',gasUsed:'0x0',difficulty:'0x0',extraData:'0x',baseFeePerGas:'0x3b9aca00'};break;
    case 'eth_gasPrice':result='0x3b9aca00';break;
    case 'eth_estimateGas':if(state.failSimulation)throw Error('execution reverted');result='0x186a0';break;
    case 'eth_call':result=contractCall(state,req.params[0].to,req.params[0].data);break;
    case 'eth_getTransactionReceipt':result=state.sends.some(tx=>tx.hash===req.params[0])?receipt(req.params[0],state):null;break;
    default:throw Error('Unhandled fixture RPC method '+req.method);
   }return{jsonrpc:'2.0',id:req.id,result};
  }catch(e){return{jsonrpc:'2.0',id:req.id,error:{code:3,message:e.message}}}};
  const body=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify(Array.isArray(body)?body.map(handle):handle(body))});
 });
 await context.route('https://api.squeekchain.com/v1/**',async route=>{
  const endpoint=new URL(route.request().url()).pathname;let body;
  if(state.apiDown)body={status:'unavailable'};
  else if(endpoint==='/v1/status')body={generatedAt:new Date().toISOString(),measurement:{freshness:'online',observedAt:new Date().toISOString(),staleAfterSeconds:120,coreStatus:state.rpm?'ACTIVE':'IDLE',rpmMilli:state.rpm,speedMmPerSecond:100},builder:{anchor:{blockHeight:'5163',blockProgress:'85514488'}}};
  else if(endpoint==='/v1/economy/state')body={status:'available',generatedAt:new Date().toISOString(),chain:{chainId:'11155111',deploymentBlock:'11998937',indexedThroughBlock:'12031840'},identities:{core:C.core,token:C.token,genesis:C.nft,mining:{proxy:C.mining},staking:{proxy:C.staking}},mining:{processedThroughRound:'669'},staking:{totalStakedBaseUnits:'0'}};
  else if(endpoint.startsWith('/v1/accounts/'))body={status:'available',chain:{indexedThroughBlock:'12031840'},tokens:state.empty?[]:[{tokenId:'8935',custody:state.deposited?'staking':'wallet',level:1}],nextCursor:null};
  else if(endpoint==='/v1/events'){
   state.eventRequests++;
   const last=new URL(route.request().url()).searchParams.has('cursor');
   const chosen=last?history.slice(0,2):history.slice(2);
   body={status:'available',nextCursor:last?null:'fixture-page-2',chain:{chainId:'11155111',safeThroughBlock:'12031828'},identities:{mining:{proxy:C.mining}},events:chosen.map(log=>({type:'system.mining_checkpointed',occurredAt:'2026-10-31T05:15:24.000Z',source:{kind:'chain',chainId:'11155111',contractAddress:C.mining,transactionHash:log.transactionHash,blockNumber:BigInt(log.blockNumber).toString()}}))};
  }
  else body={status:'unavailable'};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto(url);await page.locator('.pending-value').filter({hasText:'3'}).waitFor({timeout:2000}).catch(()=>{});
 current={state,context,page,errors};return current;
}
async function connect(page){await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:'Fixture Wallet',exact:false}).click();await expect(page.locator('.wallet-button')).toContainText('0x31bb');await expect(page.getByRole('button',{name:'Send a ping',exact:true})).toBeEnabled({timeout:15000})}
async function send(page,button){const before=current.state.sends.length;await page.getByRole('button',{name:button,exact:true}).click();await expect(page.getByRole('button',{name:'Confirm in wallet',exact:true})).toBeEnabled({timeout:10000});assert.equal(current.state.sends.length,before,'Opening a preview must not send');await page.getByRole('button',{name:'Confirm in wallet',exact:true}).click();await expect(page.getByRole('heading',{name:'Transaction sent',exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to the console',exact:true}).click()}
async function test(name,fn){if(process.argv[2]&&!name.toLowerCase().includes(process.argv[2].toLowerCase()))return;const started=Date.now();console.log('CHECK',name);try{await fn();results.push({name,passed:true});console.log('PASS',name,`${Date.now()-started}ms`)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL',name,e.message);if(current)await current.page.screenshot({path:'/tmp/squeek-validation-failure.png',fullPage:true});throw e}finally{if(current){assert.deepEqual(current.errors,[],'browser script errors');await current.context.close();current=undefined}}}
try{
 await test('Disconnected 390px first screen, EIP-6963 picker, keyboard focus and static metadata',async()=>{
  const {page}=await setup({},true);const button=page.getByRole('button',{name:'Run checkpoint',exact:true});await expect(button).toBeDisabled();const box=await button.boundingBox();assert(box.y+box.height<844);assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'./share.png');assert.equal((await page.request.get(url+'share.png')).status(),200);
  await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await expect(page.getByRole('button',{name:'Fixture Wallet',exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Browser wallet',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Coinbase Wallet',exact:false})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Connect wallet',exact:true})).toBeFocused();
  const axe=await new AxeBuilder({page}).analyze();assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 });
 await test('Automatic Sepolia switch/add, ETH balance and checkpoint confirmation boundary',async()=>{
  const {page,state}=await setup();await connect(page);const calls=await page.evaluate(()=>window.fixtureCalls);assert(calls.some(c=>c.method==='wallet_switchEthereumChain'));assert(calls.some(c=>c.method==='wallet_addEthereumChain'));
  await page.locator('.wallet-button').click();await expect(page.getByText('1 ETH',{exact:true})).toBeVisible();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Run checkpoint',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm in wallet',exact:true})).toBeEnabled();assert.equal(state.sends.length,0);await expect(page.locator('.preview-details')).toContainText(C.mining);await expect(page.locator('.preview-details')).toContainText('checkpoint()');const modalAxe=await new AxeBuilder({page}).analyze();assert.deepEqual(modalAxe.violations.map(v=>v.id),[]);
  await page.getByRole('button',{name:'Confirm in wallet',exact:true}).click();await expect(page.getByRole('heading',{name:'Transaction sent',exact:true})).toBeVisible();assert.equal(state.sends[0].method,'checkpoint');assert.equal(state.sends[0].to.toLowerCase(),C.mining);assert.equal(BigInt(state.sends[0].value??0),0n);await page.getByRole('button',{name:'Back to the console',exact:true}).click();await expect(page.locator('.checkpoint-result')).toContainText('confirmed',{timeout:15000});await page.reload();await expect(page.locator('.transaction-list')).toContainText('Run checkpoint');assert.equal(state.sends.length,1);
 });
 await test('NFT approval grants the real operator; selected deposit updates custody',async()=>{
  const {page,state}=await setup();await connect(page);await expect(page.locator('.nft-row')).toContainText('Squeek #8935');await expect(page.getByRole('button',{name:'Deposit selected',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Approve Squeeks',exact:true}).click();await expect(page.locator('.modal')).toContainText('every Squeek');await expect(page.getByRole('button',{name:'Confirm in wallet',exact:true})).toBeEnabled();assert.equal(state.sends.length,0);await page.getByRole('button',{name:'Confirm in wallet',exact:true}).click();await page.getByRole('button',{name:'Back to the console',exact:true}).click();await expect(page.getByRole('button',{name:'Revoke Squeek approval',exact:true})).toBeEnabled({timeout:15000});assert.equal(state.sends[0].args[0].toLowerCase(),C.staking);assert.equal(state.sends[0].args[1],true);await page.locator('.nft-row input').check();await send(page,'Deposit selected');assert.equal(state.sends[1].method,'deposit');assert.equal(state.sends[1].args[0].toLowerCase(),C.nft);assert.deepEqual(state.sends[1].args[1],[8935n]);await expect(page.locator('.nft-row')).toContainText('Deposited in Staking',{timeout:15000});
 });
 await test('Claim preview names the configured recipient; claimAndStake uses the account stake',async()=>{
  let instance=await setup();await connect(instance.page);await instance.page.getByRole('button',{name:'Claim rewards',exact:true}).click();await expect(instance.page.getByRole('button',{name:'Confirm in wallet',exact:true})).toBeEnabled();await expect(instance.page.locator('.preview-details')).toContainText(new RegExp(RECIPIENT,'i'));assert.equal(instance.state.sends.length,0);await instance.page.getByRole('button',{name:'Confirm in wallet',exact:true}).click();await instance.page.getByRole('button',{name:'Back to the console',exact:true}).click();assert.equal(instance.state.sends[0].method,'claim');assert.equal(instance.state.sends[0].args[0].toLowerCase(),ACCOUNT);
  await instance.context.close();instance=await setup();await connect(instance.page);await send(instance.page,'Claim and stake');assert.equal(instance.state.sends[0].method,'claimAndStake');
 });
 await test('SQK validation, exact allowance and separate stake transaction',async()=>{
  const {page,state}=await setup();await connect(page);const input=page.getByRole('textbox',{name:'SQK amount'});await input.fill('-1');await expect(input).toHaveAttribute('aria-invalid','true');await expect(page.getByRole('button',{name:'Approve SQK',exact:true})).toBeDisabled();await input.fill('101');await expect(page.getByRole('button',{name:'Stake SQK',exact:true})).toBeDisabled();await input.fill('1.5');await expect(page.getByRole('button',{name:'Stake SQK',exact:true})).toBeDisabled();await send(page,'Approve SQK');assert.equal(state.sends.length,1);assert.equal(state.sends[0].method,'approve');assert.equal(state.sends[0].args[0].toLowerCase(),C.staking);assert.equal(state.sends[0].args[1],parseEther('1.5'));await expect(page.getByRole('button',{name:'Stake SQK',exact:true})).toBeEnabled({timeout:15000});await send(page,'Stake SQK');assert.equal(state.sends[1].method,'stake');assert.equal(state.sends[1].args[0],parseEther('1.5'));
 });
 await test('Safe ping approves the wallet itself for zero; rejection sends nothing',async()=>{
  const {page,state}=await setup();await connect(page);state.reject=true;await page.getByRole('button',{name:'Send a ping',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm in wallet',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Confirm in wallet',exact:true}).click();await expect(page.locator('.inline-error')).toContainText('declined');assert.equal(state.sends.length,0);state.reject=false;await page.getByRole('button',{name:'Confirm in wallet',exact:true}).click();await expect(page.getByRole('heading',{name:'Transaction sent',exact:true})).toBeVisible();assert.equal(state.sends[0].to.toLowerCase(),C.token);assert.equal(state.sends[0].args[0].toLowerCase(),ACCOUNT);assert.equal(state.sends[0].args[1],0n);
 });
 await test('Failed simulation blocks signing; account changes close a preview',async()=>{
  const {page,state}=await setup();await connect(page);state.failSimulation=true;await page.getByRole('button',{name:'Send a ping',exact:true}).click();await expect(page.getByRole('button',{name:'Retry simulation',exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Confirm in wallet',exact:true}).count(),0);assert.equal(state.sends.length,0);state.failSimulation=false;await page.getByRole('button',{name:'Retry simulation',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm in wallet',exact:true})).toBeEnabled();await page.evaluate(()=>window.fixtureChangeAccount());await expect(page.locator('dialog')).toHaveCount(0);assert.equal(state.sends.length,0);
 });
 await test('No NFTs, no rewards and wrong network show explicit disabled states',async()=>{
  const {page}=await setup({empty:true,claimable:0n,pending:0n});await connect(page);await expect(page.locator('.inventory-empty')).toContainText('No Squeeks');await expect(page.getByRole('button',{name:'Claim rewards',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Approve Squeeks',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Run checkpoint',exact:true})).toBeDisabled();await page.evaluate(()=>window.fixtureWrongChain());await expect(page.locator('.wallet-button')).toHaveText('Switch to Sepolia');await expect(page.getByRole('button',{name:'Send a ping',exact:true})).toBeDisabled();
 });
 await test('Checkpoint leaderboard deduplicates transactions and resolves senders',async()=>{
  const {page}=await setup({history:true});await expect(page.locator('.keeper-table')).toBeVisible();await expect(page.locator('.table-footnote')).toContainText('2 checkpoint transactions');await expect(page.locator('.keeper-row')).toHaveCount(3);await expect(page.locator('.keeper-count').first()).toHaveText('1');await expect(page.locator('.table-footnote')).toContainText('RPC contract events');const tableAxe=await new AxeBuilder({page}).analyze();assert.deepEqual(tableAxe.violations.map(v=>v.id),[]);
 });
 await test('Pruned RPC history falls back to all indexed contract-event pages',async()=>{
  const {page,state}=await setup({history:true,pruned:true});await expect(page.locator('.table-footnote')).toContainText('API-indexed contract events',{timeout:10000});await expect(page.locator('.table-footnote')).toContainText('2 checkpoint transactions');assert.equal(state.eventRequests,2);
 });
 await test('API outage retains RPC balances, custody discovery and checkpoint actions',async()=>{
  const {page}=await setup({apiDown:true});await connect(page);await expect(page.locator('.nft-row')).toContainText('Squeek #8935');await expect(page.getByRole('button',{name:'Run checkpoint',exact:true})).toBeEnabled();await expect(page.locator('.wheel-live')).toContainText('Unavailable');await expect(page.locator('.strip-height')).toContainText('#5,163');
 });
 await test('Mobile without an extension lists four wallet-browser links and Smart Wallet',async()=>{
  const {page}=await setup({noWallet:true},true);await page.getByRole('button',{name:'Connect wallet',exact:true}).click();for(const name of['MetaMask','Coinbase Wallet','Rabby','Phantom'])await expect(page.getByRole('link',{name:'Open in '+name,exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Coinbase Smart Wallet',exact:false})).toBeVisible();assert.equal(await page.getByRole('button',{name:'Browser wallet',exact:true}).count(),0);const rabby=await page.getByRole('link',{name:'Open in Rabby',exact:false}).getAttribute('href');assert(rabby.includes('_cmd=open-dapp&dapp='));
 });
 await test('Responsive layout, enlarged text and reduced motion',async()=>{
  const {page}=await setup();for(const width of [320,390,720,960,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`)}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow at 200% text size');await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
 });
 console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,total:results.length,results},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
