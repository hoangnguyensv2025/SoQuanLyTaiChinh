/** Sổ Quản Lý V10 · Google Apps Script · free Google personal account.
 * Deploy: Execute as ME; Who has access: ONLY MYSELF (for one shared Gmail).
 * Do not publish to Anyone: this app has no separate user authentication yet.
 * Do not use on financial production data before a complete integration audit.
 */
const PREFIX_='SQL_V10_';
const TABLES_=['businesses','accounts','customers','products','orders','purchases','movements','expenses','transfers','audit'];
const HEADERS_=['id','version','updatedAt','payloadJson'];
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('Sổ Quản Lý V10').addMetaTag('viewport','width=device-width,initial-scale=1');}
function prop_(){return PropertiesService.getScriptProperties()}
function folder_(parent,name){const found=parent.getFoldersByName(name);return found.hasNext()?found.next():parent.createFolder(name)}
function setup_(){
 const p=prop_();let folderId=p.getProperty(PREFIX_+'FOLDER');let root;
 if(folderId){try{root=DriveApp.getFolderById(folderId)}catch(e){root=null}}
 if(!root){root=folder_(DriveApp.getRootFolder(),'SoQuanLy_App_Data');p.setProperty(PREFIX_+'FOLDER',root.getId())}
 const images=folder_(root,'Images');const backups=folder_(root,'Backups');const attachments=folder_(root,'Attachments');
 let id=p.getProperty(PREFIX_+'SHEET');let book=null;
 if(id){try{book=SpreadsheetApp.openById(id)}catch(e){book=null}}
 if(!book){const files=root.getFilesByName('SoQuanLy_Database');while(files.hasNext()){const f=files.next();if(f.getMimeType()==='application/vnd.google-apps.spreadsheet'){book=SpreadsheetApp.openById(f.getId());break}}
 if(!book){book=SpreadsheetApp.create('SoQuanLy_Database');DriveApp.getFileById(book.getId()).moveTo(root)}p.setProperty(PREFIX_+'SHEET',book.getId())}
 TABLES_.concat(['settings','invoiceSequences']).forEach(name=>{let sheet=book.getSheetByName(name);if(!sheet){sheet=book.insertSheet(name);sheet.getRange(1,1,1,4).setValues([HEADERS_]);sheet.setFrozenRows(1)}});
 const initial=book.getSheetByName('Sheet1');if(initial&&initial.getLastRow()===0&&book.getSheets().length>1)book.deleteSheet(initial);
 return {book,root,images,backups,attachments}
}
function initial_(){const b=Utilities.getUuid(),cash=Utilities.getUuid(),bank=Utilities.getUuid();return {
 businesses:[{id:b,name:'Kinh doanh chính',active:true,createdAt:new Date().toISOString().slice(0,10)}],
 accounts:[{id:cash,name:'Tiền mặt',opening:0,scope:'shared',businessId:null,active:true},{id:bank,name:'Ngân hàng',opening:0,scope:'shared',businessId:null,active:true}],
 customers:[],products:[],orders:[],purchases:[],movements:[],expenses:[],transfers:[],audit:[],
 settings:{defaultBusiness:b,defaultAccount:cash,defaultPersonalAccount:cash,defaultPurchaseAccount:cash,defaultSaleAccount:cash},invoiceSequences:{}}}
function rows_(sheet){const last=sheet.getLastRow();return last<2?[]:sheet.getRange(2,1,last-1,4).getValues()}
function readAll_(book){const out={};TABLES_.forEach(t=>{out[t]=rows_(book.getSheetByName(t)).map(r=>JSON.parse(r[3])).filter(Boolean)});
 for(const name of ['settings','invoiceSequences']){const rr=rows_(book.getSheetByName(name));out[name]=rr.length?JSON.parse(rr[0][3]):{}}
 return out}
function getRev_(){return Number(prop_().getProperty(PREFIX_+'REV')||'0')}
function withLock_(run){const lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw new Error('SERVER_BUSY: hãy thử lại');try{return run()}finally{lock.releaseLock()}}
/** First run creates folders and spreadsheet. Subsequent visits only read. */
function apiInitialize(){return withLock_(()=>{const o=setup_(),p=prop_();if(!p.getProperty(PREFIX_+'SEEDED')){
 const biz=o.book.getSheetByName('businesses');if(biz.getLastRow()<2){const seed=initial_();for(const t of TABLES_){if(seed[t].length)o.book.getSheetByName(t).getRange(2,1,seed[t].length,4).setValues(seed[t].map(r=>[r.id,Number(r.version||0),new Date().toISOString(),JSON.stringify(r)]))}
 for(const key of ['settings','invoiceSequences'])o.book.getSheetByName(key).getRange(2,1,1,4).setValues([[key,1,new Date().toISOString(),JSON.stringify(seed[key])]])}}
 p.setProperty(PREFIX_+'SEEDED','true')}
 return {ok:true,data:readAll_(o.book),revision:getRev_(),folderId:o.root.getId(),spreadsheetId:o.book.getId()}})}
/** Incremental updates: validate versions of ONLY changed records, not the whole database.
 * Changing different records concurrently is permitted. Same-record concurrent saves conflict.
 * A batch write across several sheets isn't fully transactional; suitable for testing,
 * production accounting requires an append-only event journal and replay/recovery.
 */
function apiCommit(req){if(!req||!Array.isArray(req.changes)||req.changes.length>200)throw new Error('BATCH_LIMIT');return withLock_(()=>{
 const p=prop_(),book=setup_().book;
 const changes=req.changes;const seen=new Set();const plans=[];const cache={};const assignedCodes=[];
 for(const ch of changes){if(!TABLES_.includes(ch.table)&&!['settings','invoiceSequences'].includes(ch.table))throw new Error('INVALID_TABLE');if(!ch.id)throw new Error('INVALID_ID');const tag=ch.table+':'+ch.id;if(seen.has(tag))throw new Error('DUPLICATE_ID');seen.add(tag);
 if(!cache[ch.table]){const sheet=book.getSheetByName(ch.table);const rows=rows_(sheet);const index=new Map();rows.forEach((r,i)=>index.set(String(r[0]),{row:i+2,version:Number(r[1]||0),json:r[3]}));cache[ch.table]={sheet,index,nextRow:sheet.getLastRow()+1}}
 const c=cache[ch.table],old=c.index.get(String(ch.id));
 if(ch.singleton){const previous=old?JSON.parse(old.json):{};if(JSON.stringify(previous)!==JSON.stringify(ch.oldValue||{}))return {ok:false,error:'SETTING_CONFLICT'};plans.push({...ch,row:old?.row||0,version:(old?.version||0)+1});continue}
 const currentVersion=old?.version||0;
 if(currentVersion!==Number(ch.oldVersion||0))return {ok:false,error:'VERSION_CONFLICT',table:ch.table,id:ch.id};
 if(ch.record&&String(ch.record.id)!==String(ch.id))throw new Error('ID_MISMATCH');plans.push({...ch,row:old?.row||0,version:currentVersion+1})
 }
 // Reserve invoice numbers within the same script lock. Never trust client-generated codes.
 const orderPlans=plans.filter(ch=>ch.table==='orders'&&!ch.row&&!ch.deleted&&!ch.singleton);
 if(orderPlans.length){const sheet=book.getSheetByName('orders');const stored=rows_(sheet).map(r=>JSON.parse(r[3]));
 const largest={};for(const o of stored){const c=String(o.code||'');if(/^\d{14}$/.test(c)){const day=c.slice(0,8);largest[day]=Math.max(largest[day]||0,Number(c.slice(8)))}}
 for(const ch of orderPlans){const day=String(ch.record.date||'').replace(/-/g,'').slice(0,8);if(!/^\d{8}$/.test(day))throw new Error('INVALID_INVOICE_DATE');const next=(largest[day]||0)+1;largest[day]=next;ch.record.code=day+String(next).padStart(6,'0');assignedCodes.push({id:ch.id,code:ch.record.code})}}
 // Apply deletions descending within each table to keep row references valid.
 const deletes=plans.filter(ch=>ch.deleted&&ch.row).sort((a,b)=>a.table===b.table?b.row-a.row:a.table.localeCompare(b.table));
 const writes=plans.filter(ch=>!ch.deleted);
 for(const ch of writes){const c=cache[ch.table];
 const value=ch.singleton?ch.value:{...ch.record,version:ch.version,updatedAt:new Date().toISOString()};
 const row=ch.row||c.nextRow++;c.sheet.getRange(row,1,1,4).setValues([[ch.id,ch.version,new Date().toISOString(),JSON.stringify(value)]])}
 for(const ch of deletes)cache[ch.table].sheet.deleteRow(ch.row);
 SpreadsheetApp.flush();const rev=getRev_()+1;p.setProperty(PREFIX_+'REV',String(rev));return {ok:true,revision:rev,assignedCodes}
 })}
/** Information-only: folder IDs remain server-side; raw Drive access never passed to client. */
function apiConnectionStatus(){const p=prop_();return {configured:!!p.getProperty(PREFIX_+'SHEET'),version:'10.0'}}
