-- Crée la table qui stocke le contrat rempli / signé
-- (à exécuter dans Supabase > SQL Editor)

create table if not exists public.booking_contracts (
  id uuid primary key default gen_random_uuid(),
  -- On stocke l'ID en TEXT pour être compatible quel que soit le type de la colonne booking_requests.id (bigint, uuid, etc.)
  booking_request_id text not null unique,

  -- Coordonnées du signataire
  signer_address_line1 text not null,
  signer_address_line2 text,
  signer_postal_code text not null,
  signer_city text not null,
  signer_country text not null,

  -- Liste des personnes présentes (nom/prénom/âge)
  occupants jsonb not null default '[]'::jsonb,

  -- Preuve de signature
  accepted_terms boolean not null default false,
  signed_at timestamptz not null default now(),
  ip text,
  user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trigger pour updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'booking_contracts_set_updated_at'
  ) then
    create trigger booking_contracts_set_updated_at
    before update on public.booking_contracts
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;
