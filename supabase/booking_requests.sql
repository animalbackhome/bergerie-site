-- supabase/booking_requests.sql
create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,

  status text not null default 'pending' check (status in ('pending','accepted','refused')),

  name text not null,
  email text not null,
  phone text,

  start_date text not null,
  end_date text not null,
  nights int not null default 0,

  adults int not null default 0,
  children int not null default 0,

  animal_type text,
  other_animal_label text,
  animals_count int not null default 0,

  wood_quarter_steres int not null default 0,
  visitors_count int not null default 0,

  extra_sleepers_count int not null default 0,
  extra_sleepers_nights int not null default 0,

  early_arrival boolean not null default false,
  late_departure boolean not null default false,

  message text not null,
  pricing jsonb not null default '{}'::jsonb,
  airbnb_calendar_url text
);

create index if not exists booking_requests_created_at_idx on booking_requests (created_at desc);
create index if not exists booking_requests_status_idx on booking_requests (status);
