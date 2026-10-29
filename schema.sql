create table if not exists users(id serial primary key,name text not null,email text unique not null,password_hash text not null,
 role text not null default 'user' check(role in('user','admin')),balance numeric(12,2) not null default 0 check(balance>=0),
 active boolean not null default true,created_at timestamptz not null default now());
create table if not exists deposits(id serial primary key,ref_id text unique not null,user_id int not null references users(id),
 account_id text not null,amount numeric(12,2) not null check(amount>0),method text not null check(method in('bkash','nagad')),
 sender_number text not null,txn_id text unique not null,status text not null default 'pending' check(status in('pending','approved','rejected')),
 reviewed_by int references users(id),reviewed_at timestamptz,created_at timestamptz not null default now());
create table if not exists transactions(id serial primary key,user_id int not null references users(id),
 deposit_id int unique references deposits(id),type text not null,amount numeric(12,2) not null,balance_after numeric(12,2) not null,created_at timestamptz not null default now());
create table if not exists audit_logs(id serial primary key,actor_id int references users(id),action text not null,details jsonb,created_at timestamptz not null default now());
create table if not exists announcements(id serial primary key,title text not null,body text not null,created_at timestamptz not null default now());
create table if not exists settings(key text primary key,value text not null);
insert into settings(key,value) values('payment_number','01613329049'),('support_text','Need help? Contact the site administrator with your reference ID.') on conflict do nothing;
