// node test_core.js — isolated business arithmetic regression smoke tests.
const fs=require('fs'),vm=require('vm');let s=fs.readFileSync(__dirname+'/app.js','utf8');s=s.slice(0,s.indexOf("$('#importFile').onchange"));const ctx={console,structuredClone,crypto:require('crypto').webcrypto,document:{querySelector:()=>null,querySelectorAll:()=>[]}};vm.createContext(ctx);vm.runInContext(s,ctx);vm.runInContext(`
db=initial();const b=db.businesses[0].id,a=db.accounts[0].id;
db.products.push({id:'p',businessId:b,name:'Sản phẩm',openingQty:10,openingCost:30000,price:50000});
db.purchases.push({id:'buy',businessId:b,date:'2026-10-01',accountId:a,paid:120000,lines:[{productId:'p',qty:5,cost:24000}]});
db.orders.push({id:'sale',kind:'normal',businessId:b,date:'2026-10-02',accountId:a,paid:100000,total:100000,status:'completed',lines:[{productId:'p',qty:2,costSnapshot:28000}]});
function check(v,label){if(!v)throw Error('FAIL: '+label);console.log('PASS: '+label)}
check(qtyStock('p')===13,'purchase/sale stock');check(stats(b).profit===44000,'sales profit');check(accountBalance(a)===-20000,'account payment ledger');
db.expenses.push({id:'e1',domain:'business',businessId:b,accountId:a,type:'expense',amount:5000,date:'2026-10-02',allocations:[{businessId:b,amount:5000}]});
check(stats(b).profit===39000,'business fee reduces profit');
db.expenses.push({id:'e2',domain:'personal',businessId:b,accountId:a,type:'expense',amount:9000,date:'2026-10-02'});
check(stats(b).profit===39000,'personal expense excluded from business profit');check(accountBalance(a)===-34000,'personal expense reduces shared account');
db.orders[0].status='returned';db.orders[0].refund=100000;check(qtyStock('p')===15,'full return restock');check(stats(b).revenue===0,'return excluded from revenue');check(accountBalance(a)===-134000,'refund debited once');
db.transfers.push({id:'t',from:a,to:db.accounts[1].id,amount:20000});
check(accountBalance(a)+accountBalance(db.accounts[1].id)===-134000,'transfer preserves total money');
`,ctx);
