require('dotenv').config();const {Pool}=require('pg'),fs=require('fs');
const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:false});
p.query(fs.readFileSync(__dirname+'/../schema.sql','utf8')).then(()=>{console.log('Schema ready');p.end()}).catch(e=>{console.error(e.message);process.exit(1)});
