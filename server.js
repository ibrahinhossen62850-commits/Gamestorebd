require('dotenv').config();
const express=require('express'),helmet=require('helmet'),session=require('express-session'),PgStore=require('connect-pg-simple')(session),
rateLimit=require('express-rate-limit'),bcrypt=require('bcryptjs'),crypto=require('crypto'),{Pool}=require('pg');
if(!process.env.SESSION_SECRET||!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL and SESSION_SECRET');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:false});
const prod=process.env.NODE_ENV==='production',app=express();
app.set('trust proxy',1);app.use(helmet());app.use(express.json({limit:'10kb'}));
app.use(session({store:new PgStore({pool,tableName:'session',createTableIfMissing:true}),secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,name:'sid',
 cookie:{httpOnly:true,sameSite:'strict',secure:prod,maxAge:7*864e5}}));
app.use('/api',rateLimit({windowMs:15*60e3,limit:300}));
const loginLimit=rateLimit({windowMs:15*60e3,limit:10,message:{error:'Too many attempts. Try again in 15 minutes.'}});
const wrap=f=>(q,s,n)=>Promise.resolve(f(q,s,n)).catch(e=>{console.error(e);s.status(500).json({error:'Server error. Please try again.'})});
const q=(t,p)=>pool.query(t,p);
const auth=wrap(async(req,res,next)=>{if(!req.session.uid)return res.status(401).json({error:'Please log in.'});
 const u=(await q('select active from users where id=$1',[req.session.uid])).rows[0];
 if(!u||!u.active)return req.session.destroy(()=>res.status(401).json({error:'Account unavailable.'}));next()});
const admin=wrap(async(req,res,next)=>{if(!req.session.uid)return res.status(401).json({error:'Please log in.'});
 const u=(await q('select role,active from users where id=$1',[req.session.uid])).rows[0];
 if(!u||!u.active||u.role!=='admin')return res.status(403).json({error:'Forbidden'});next()});
const audit=(c,actor,action,details)=>c.query('insert into audit_logs(actor_id,action,details) values($1,$2,$3)',[actor,action,details||{}]);
const bad=(res,m)=>res.status(400).json({error:m});
const DUMMY=bcrypt.hashSync('x',12);

app.post('/api/register',loginLimit,wrap(async(req,res)=>{
 const {name,email,password}=req.body||{};
 if(typeof name!=='string'||name.trim().length<2||name.length>50)return bad(res,'Enter your name (2-50 characters).');
 if(typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>120)return bad(res,'Enter a valid email.');
 if(typeof password!=='string'||password.length<8||password.length>72)return bad(res,'Password must be 8-72 characters.');
 try{const r=await q('insert into users(name,email,password_hash) values($1,$2,$3) returning id',[name.trim(),email.toLowerCase(),await bcrypt.hash(password,12)]);
  await new Promise((ok,no)=>req.session.regenerate(e=>e?no(e):ok()));req.session.uid=r.rows[0].id;res.json({ok:true})}
 catch(e){if(e.code==='23505')return bad(res,'This email is already registered.');throw e}}));
app.post('/api/login',loginLimit,wrap(async(req,res)=>{
 const {email,password}=req.body||{};
 if(typeof email!=='string'||typeof password!=='string')return bad(res,'Enter email and password.');
 const u=(await q('select * from users where email=$1',[email.toLowerCase()])).rows[0];
 const ok=await bcrypt.compare(password,u?u.password_hash:DUMMY);
 if(!u||!ok)return res.status(401).json({error:'Wrong email or password.'});
 if(!u.active)return res.status(403).json({error:'This account is suspended.'});
 await new Promise((a,b)=>req.session.regenerate(e=>e?b(e):a()));req.session.uid=u.id;res.json({ok:true})}));
app.post('/api/logout',(req,res)=>req.session.destroy(()=>{res.clearCookie('sid');res.json({ok:true})}));
app.get('/api/me',wrap(async(req,res)=>{
 const s=Object.fromEntries((await q('select key,value from settings')).rows.map(r=>[r.key,r.value]));
 const ann=(await q('select id,title,body,created_at from announcements order by id desc limit 5')).rows;
 let user=null;
 if(req.session.uid)user=(await q('select id,name,email,role,balance from users where id=$1 and active',[req.session.uid])).rows[0]||null;
 res.json({user,payment_number:s.payment_number,support_text:s.support_text,announcements:ann})}));
app.get('/api/deposits',auth,wrap(async(req,res)=>res.json((await q('select ref_id,amount,method,txn_id,status,created_at from deposits where user_id=$1 order by id desc limit 100',[req.session.uid])).rows)));
app.get('/api/transactions',auth,wrap(async(req,res)=>res.json((await q('select type,amount,balance_after,created_at from transactions where user_id=$1 order by id desc limit 100',[req.session.uid])).rows)));
app.post('/api/deposits',auth,wrap(async(req,res)=>{
 const b=req.body||{},amount=Number(b.amount),method=b.method,sender=String(b.sender_number||'').trim(),txn=String(b.txn_id||'').trim().toUpperCase(),acc=String(b.account_id||'').trim();
 if(!/^[A-Za-z0-9_-]{3,40}$/.test(acc))return bad(res,'Enter a valid account ID (3-40 letters/numbers).');
 if(!Number.isFinite(amount)||amount<50||amount>50000||Math.round(amount*100)!==amount*100)return bad(res,'Amount must be between 50 and 50,000.');
 if(!['bkash','nagad'].includes(method))return bad(res,'Choose bKash or Nagad.');
 if(!/^01[3-9]\d{8}$/.test(sender))return bad(res,'Enter a valid 11-digit sender number.');
 if(!/^[A-Z0-9]{6,20}$/.test(txn))return bad(res,'Transaction ID must be 6-20 letters/numbers.');
 const pend=(await q("select count(*)::int c from deposits where user_id=$1 and status='pending'",[req.session.uid])).rows[0].c;
 if(pend>=5)return bad(res,'You have too many pending deposits. Please wait for review.');
 const ref='DP-'+crypto.randomBytes(5).toString('hex').toUpperCase();
 try{await q('insert into deposits(ref_id,user_id,account_id,amount,method,sender_number,txn_id) values($1,$2,$3,$4,$5,$6,$7)',[ref,req.session.uid,acc,amount,method,sender,txn]);
  res.json({ok:true,ref_id:ref})}catch(e){if(e.code==='23505')return bad(res,'This transaction ID was already submitted.');throw e}}));

// ---- admin ----
app.get('/api/admin/stats',admin,wrap(async(req,res)=>res.json((await q(`select (select count(*)::int from users) users,
 count(*) filter(where status='pending')::int pending,count(*) filter(where status='approved')::int approved,count(*) filter(where status='rejected')::int rejected,
 coalesce(sum(amount) filter(where status='approved'),0) approved_total from deposits`)).rows[0])));
app.get('/api/admin/deposits',admin,wrap(async(req,res)=>{const st=['pending','approved','rejected'].includes(req.query.status)?req.query.status:null;
 res.json((await q(`select d.id,d.ref_id,d.account_id,d.amount,d.method,d.sender_number,d.txn_id,d.status,d.created_at,u.email from deposits d join users u on u.id=d.user_id
 where ($1::text is null or d.status=$1) order by d.id desc limit 200`,[st])).rows)}));
const review=act=>wrap(async(req,res)=>{
 const id=parseInt(req.params.id,10);if(!id)return bad(res,'Invalid ID');
 const c=await pool.connect();
 try{await c.query('begin');
  const d=(await c.query('select * from deposits where id=$1 for update',[id])).rows[0];
  if(!d){await c.query('rollback');return res.status(404).json({error:'Not found'})}
  if(d.status!=='pending'){await c.query('rollback');return res.status(409).json({error:'Already reviewed.'})}
  const st=act==='approve'?'approved':'rejected';
  await c.query('update deposits set status=$1,reviewed_by=$2,reviewed_at=now() where id=$3',[st,req.session.uid,id]);
  if(act==='approve'){const u=(await c.query('update users set balance=balance+$1 where id=$2 returning balance',[d.amount,d.user_id])).rows[0];
   await c.query("insert into transactions(user_id,deposit_id,type,amount,balance_after) values($1,$2,'deposit',$3,$4)",[d.user_id,id,d.amount,u.balance])}
  await audit(c,req.session.uid,'deposit_'+st,{deposit_id:id,ref:d.ref_id,amount:d.amount});
  await c.query('commit');res.json({ok:true})
 }catch(e){await c.query('rollback').catch(()=>{});throw e}finally{c.release()}});
app.post('/api/admin/deposits/:id/approve',admin,review('approve'));
app.post('/api/admin/deposits/:id/reject',admin,review('reject'));
app.get('/api/admin/users',admin,wrap(async(req,res)=>res.json((await q('select id,name,email,role,balance,active,created_at from users order by id desc limit 200')).rows)));
app.post('/api/admin/users/:id/toggle',admin,wrap(async(req,res)=>{const id=parseInt(req.params.id,10);
 const r=await q("update users set active=not active where id=$1 and role='user' returning active",[id]);
 if(!r.rowCount)return bad(res,'Cannot change this user.');await audit(pool,req.session.uid,'user_toggle',{user_id:id,active:r.rows[0].active});res.json({ok:true})}));
app.get('/api/admin/transactions',admin,wrap(async(req,res)=>res.json((await q('select t.id,t.type,t.amount,t.balance_after,t.created_at,u.email from transactions t join users u on u.id=t.user_id order by t.id desc limit 200')).rows)));
app.post('/api/admin/announcements',admin,wrap(async(req,res)=>{const {title,body}=req.body||{};
 if(typeof title!=='string'||!title.trim()||title.length>100||typeof body!=='string'||!body.trim()||body.length>1000)return bad(res,'Title (max 100) and message (max 1000) required.');
 await q('insert into announcements(title,body) values($1,$2)',[title.trim(),body.trim()]);await audit(pool,req.session.uid,'announce',{title});res.json({ok:true})}));
app.delete('/api/admin/announcements/:id',admin,wrap(async(req,res)=>{await q('delete from announcements where id=$1',[parseInt(req.params.id,10)||0]);res.json({ok:true})}));
app.put('/api/admin/settings',admin,wrap(async(req,res)=>{const {payment_number,support_text}=req.body||{};
 if(!/^01[3-9]\d{8}$/.test(String(payment_number)))return bad(res,'Invalid payment number.');
 if(typeof support_text!=='string'||support_text.length>500)return bad(res,'Support text max 500 characters.');
 await q('insert into settings(key,value) values($1,$2),($3,$4) on conflict(key) do update set value=excluded.value',['payment_number',payment_number,'support_text',support_text]);
 await audit(pool,req.session.uid,'settings_update',{payment_number});res.json({ok:true})}));
app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
app.use(express.static(__dirname+'/public'));
app.listen(process.env.PORT||3000,()=>console.log('Running'));
