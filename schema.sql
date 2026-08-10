create table if not exists public.orders (
  id text primary key,
  items jsonb not null,
  total numeric(10,2) not null,
  fulfillment text not null check (fulfillment in ('Pickup','Delivery')),
  customer_name text not null,
  phone text not null,
  address text default '',
  notes text default '',
  status text not null default 'Placed',
  payment_status text not null default 'Unpaid',
  created_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
