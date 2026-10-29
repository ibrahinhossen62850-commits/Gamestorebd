// Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-unique-password' npm run create-admin
require('dotenv').config();const {Pool}=require('pg'),bcrypt=require('bcryptjs');
const {ADMIN_EMAIL:e,ADMIN_PASSWORD:pw}=process.env;
if(!e||!pw||pw.length<12){console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) in the shell for this one command.');process.exit(1)}
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:false});
(async()=>{const h=await bcrypt.hash(pw,12);
await p.query("insert into users(name,email,password_hash,role) values('Admin',$1,$2,'admin') on conflict(email) do update set password_hash=$2,role='admin'",[e.toLowerCase(),h]);
console.log('Admin ready:',e);await p.end()})().catch(x=>{console.error(x.message);process.exit(1)});
