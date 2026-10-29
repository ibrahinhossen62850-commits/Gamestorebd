const $=s=>document.querySelector(s),app=$('#app');let me=null,info={},tab='stats';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'৳'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2});
const dt=s=>new Date(s).toLocaleString();const badge=s=>`<span class="b ${esc(s)}">${esc(s)}</span>`;
async function api(p,o={}){const r=await fetch('/api'+p,{method:o.method||'GET',headers:{'Content-Type':'application/json'},body:o.body?JSON.stringify(o.body):undefined});
 let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'Request failed. Check your connection.');return d}
function toast(m,bad){const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3500)}
const table=(h,rows)=>`<div class="tw"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.length?rows.join(''):`<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table></div>`;
const ann=()=>(info.announcements||[]).map(a=>`<div class="card"><b>📢 ${esc(a.title)}</b><p>${esc(a.body)}</p></div>`).join('');
async function refresh(){try{info=await api('/me');me=info.user}catch{me=null}}
function nav(){const h=location.hash||'#/';const l=(p,t)=>`<a href="#${p}" class="${h==='#'+p?'on':''}">${t}</a>`;
 $('#nav').innerHTML=me?l('/','Home')+l('/deposit','Deposit')+l('/history','History')+l('/support','Support')+(me.role==='admin'?l('/admin','Admin'):'')+'<button data-act="logout">Logout</button>':l('/login','Login')+l('/register','Register')}
const views={
 home(){return me?`<div class="card"><div>Hello, ${esc(me.name)}</div><div class="bal">${money(me.balance)}</div><a class="btn" href="#/deposit">Add balance</a></div>${ann()}<div class="card"><h2>Recent deposits</h2><div id="rd"><div class="spin"></div></div></div>`
  :`<div class="hero"><h1>Top up. Play. Repeat.</h1><p>Add balance with bKash or Nagad. Deposits are checked manually by our team.</p><a class="btn" href="#/register">Get started</a></div>${ann()}`},
 login(){return form('login','Login',[['email','Email','email'],['password','Password','password']],'Login')},
 register(){return form('register','Create account',[['name','Name','text'],['email','Email','email'],['password','Password (8+ chars)','password']],'Register')},
 deposit(){return`<div class="card"><h2>Deposit</h2><p>Send money by bKash or Nagad (Send Money) to:</p><div class="num"><span id="pn">${esc(info.payment_number)}</span><button data-act="copy">Copy</button></div>
  <div class="note">⚠️ Submitting a transaction ID does <b>not</b> credit your balance automatically. An admin verifies each payment manually, then approves or rejects it. Fake or duplicate IDs are rejected.</div>
  <form data-form="deposit"><label>Account ID</label><input name="account_id" required><label>Amount (৳50 – 50,000)</label><input name="amount" type="number" min="50" max="50000" step="0.01" required>
  <label>Payment method</label><select name="method"><option value="bkash">bKash</option><option value="nagad">Nagad</option></select>
  <label>Your sender number</label><input name="sender_number" inputmode="numeric" placeholder="01XXXXXXXXX" required><label>Transaction ID</label><input name="txn_id" required><button class="p">Submit deposit request</button></form><div id="res"></div></div>`},
 history(){return`<div class="card"><h2>Deposits</h2><div id="h1"><div class="spin"></div></div></div><div class="card"><h2>Transactions</h2><div id="h2"><div class="spin"></div></div></div>`},
 support(){return`<div class="card"><h2>Support</h2><p>${esc(info.support_text)}</p><p>Typical review: deposits are checked manually, so approval can take some time. Keep your reference ID (DP-…) handy.</p></div>`},
 admin(){const t=[['stats','Dashboard'],['deposits','Deposits'],['users','Users'],['tx','Transactions'],['ann','Announcements'],['set','Settings']];
  return`<div class="tabs">${t.map(x=>`<button data-act="tab" data-id="${x[0]}" class="${tab===x[0]?'on':''}">${x[1]}</button>`).join('')}</div><div id="ad"><div class="spin"></div></div>`}};
function form(f,title,fields,btn){return`<div class="card"><h2>${title}</h2><form data-form="${f}">${fields.map(x=>`<label>${x[1]}</label><input name="${x[0]}" type="${x[2]}" required>`).join('')}<button class="p">${btn}</button></form></div>`}
const after={
 async home(){if(!me)return;const d=await api('/deposits');$('#rd').innerHTML=table(['Ref','Amount','Status'],d.slice(0,5).map(x=>`<tr><td>${esc(x.ref_id)}</td><td>${money(x.amount)}</td><td>${badge(x.status)}</td></tr>`))},
 async history(){const [d,t]=await Promise.all([api('/deposits'),api('/transactions')]);
  $('#h1').innerHTML=table(['Ref','Amount','Method','Txn ID','Status','Date'],d.map(x=>`<tr><td>${esc(x.ref_id)}</td><td>${money(x.amount)}</td><td>${esc(x.method)}</td><td>${esc(x.txn_id)}</td><td>${badge(x.status)}</td><td>${dt(x.created_at)}</td></tr>`));
  $('#h2').innerHTML=table(['Type','Amount','Balance after','Date'],t.map(x=>`<tr><td>${esc(x.type)}</td><td>${money(x.amount)}</td><td>${money(x.balance_after)}</td><td>${dt(x.created_at)}</td></tr>`))},
 async admin(){const box=$('#ad');
  if(tab==='stats'){const s=await api('/admin/stats');box.innerHTML=`<div class="grid"><div class="card"><b>${s.users}</b>Users</div><div class="card"><b>${s.pending}</b>Pending</div><div class="card"><b>${s.approved}</b>Approved</div><div class="card"><b>${s.rejected}</b>Rejected</div><div class="card"><b>${money(s.approved_total)}</b>Approved total</div></div>`}
  if(tab==='deposits'){const d=await api('/admin/deposits');box.innerHTML=table(['Ref','User','Acct','Amount','Method','Sender','Txn ID','Status',''],d.map(x=>`<tr><td>${esc(x.ref_id)}</td><td>${esc(x.email)}</td><td>${esc(x.account_id)}</td><td>${money(x.amount)}</td><td>${esc(x.method)}</td><td>${esc(x.sender_number)}</td><td>${esc(x.txn_id)}</td><td>${badge(x.status)}</td><td>${x.status==='pending'?`<button class="s" data-act="approve" data-id="${x.id}">Approve</button> <button class="s r" data-act="reject" data-id="${x.id}">Reject</button>`:''}</td></tr>`))}
  if(tab==='users'){const d=await api('/admin/users');box.innerHTML=table(['Name','Email','Role','Balance','Active',''],d.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td>${money(x.balance)}</td><td>${x.active?'yes':'no'}</td><td>${x.role==='user'?`<button class="s r" data-act="toggle" data-id="${x.id}">${x.active?'Suspend':'Restore'}</button>`:''}</td></tr>`))}
  if(tab==='tx'){const d=await api('/admin/transactions');box.innerHTML=table(['User','Type','Amount','Balance after','Date'],d.map(x=>`<tr><td>${esc(x.email)}</td><td>${esc(x.type)}</td><td>${money(x.amount)}</td><td>${money(x.balance_after)}</td><td>${dt(x.created_at)}</td></tr>`))}
  if(tab==='ann'){box.innerHTML=`<div class="card"><form data-form="announce"><label>Title</label><input name="title" maxlength="100" required><label>Message</label><textarea name="body" maxlength="1000" required></textarea><button class="p">Post</button></form></div>`+(info.announcements||[]).map(a=>`<div class="card">${esc(a.title)} <button class="s r" data-act="delann" data-id="${a.id}">Delete</button></div>`).join('')}
  if(tab==='set'){box.innerHTML=`<div class="card"><form data-form="settings"><label>Payment number</label><input name="payment_number" value="${esc(info.payment_number)}" required><label>Support text</label><textarea name="support_text" maxlength="500">${esc(info.support_text)}</textarea><button class="p">Save</button></form></div>`}}};
const forms={
 async login(d){await api('/login',{method:'POST',body:d});await refresh();location.hash='#/';route()},
 async register(d){await api('/register',{method:'POST',body:d});await refresh();location.hash='#/';route()},
 async deposit(d,f){const r=await api('/deposits',{method:'POST',body:{...d,amount:Number(d.amount)}});f.reset();$('#res').innerHTML=`<div class="note">Request submitted. Reference ID: <b>${esc(r.ref_id)}</b>. Status: pending admin verification.</div>`},
 async announce(d){await api('/admin/announcements',{method:'POST',body:d});await refresh();toast('Posted');route()},
 async settings(d){await api('/admin/settings',{method:'PUT',body:d});await refresh();toast('Saved')}};
const acts={
 async logout(){await api('/logout',{method:'POST'});me=null;location.hash='#/login';route()},
 copy(){navigator.clipboard.writeText(info.payment_number).then(()=>toast('Number copied'),()=>toast('Copy failed',1))},
 tab(id){tab=id;route()},
 async approve(id){if(confirm('Verified this payment? Balance will be credited.')){await api(`/admin/deposits/${id}/approve`,{method:'POST'});toast('Approved');route()}},
 async reject(id){if(confirm('Reject this deposit?')){await api(`/admin/deposits/${id}/reject`,{method:'POST'});toast('Rejected');route()}},
 async toggle(id){await api(`/admin/users/${id}/toggle`,{method:'POST'});route()},
 async delann(id){await api(`/admin/announcements/${id}`,{method:'DELETE'});await refresh();route()}};
document.addEventListener('submit',async e=>{const f=e.target.dataset.form;if(!f)return;e.preventDefault();const b=e.target.querySelector('button.p');b.disabled=true;
 try{await forms[f](Object.fromEntries(new FormData(e.target)),e.target)}catch(x){toast(x.message,1)}b.disabled=false});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;try{await acts[b.dataset.act](b.dataset.id)}catch(x){toast(x.message,1)}});
async function route(){const p=(location.hash||'#/').slice(2)||'home';let v=views[p]?p:'home';
 if(['deposit','history','support'].includes(v)&&!me)v='login';if(v==='admin'&&(!me||me.role!=='admin'))v='home';if((v==='login'||v==='register')&&me)v='home';
 nav();app.innerHTML=views[v]();try{if(after[v])await after[v]()}catch(x){toast(x.message,1)}}
addEventListener('hashchange',route);app.innerHTML='<div class="spin"></div>';refresh().then(route);
