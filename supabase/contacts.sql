-- =====================================================================
-- WorkFlow : tables pour la page Contacts
-- À exécuter UNE fois dans Supabase : Dashboard > SQL Editor > New query,
-- coller tout ce fichier, puis « Run ».
-- Le script peut être relancé sans danger (if not exists / or replace).
-- =====================================================================


-- ---------- 1. Profils publics ----------
-- Le nom d'utilisateur est gardé dans les métadonnées de Supabase Auth,
-- que le navigateur ne peut pas chercher. On le copie dans une table
-- « profiles » pour pouvoir retrouver quelqu'un par son nom d'utilisateur.
-- (dm.js lit déjà cette table pour la liste des messages privés.)

create table if not exists public.profiles (
    id         uuid primary key references auth.users (id) on delete cascade,
    username   text,
    full_name  text,
    created_at timestamptz not null default now()
);

create index if not exists profiles_username_lower_idx
    on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "Profils visibles par les membres connectés" on public.profiles;
create policy "Profils visibles par les membres connectés"
    on public.profiles for select
    to authenticated
    using (true);

grant select on public.profiles to authenticated;


-- Copie automatique : à l'inscription et quand le profil est modifié
-- (profil.js modifie les métadonnées avec auth.updateUser).
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, username, full_name)
    values (
        new.id,
        new.raw_user_meta_data ->> 'username',
        new.raw_user_meta_data ->> 'full_name'
    )
    on conflict (id) do update
        set username  = excluded.username,
            full_name = excluded.full_name;
    return new;
end;
$$;

drop trigger if exists on_auth_user_saved on auth.users;
create trigger on_auth_user_saved
    after insert or update of raw_user_meta_data on auth.users
    for each row execute function public.sync_profile_from_auth();


-- Comptes déjà créés avant ce script
insert into public.profiles (id, username, full_name)
select id,
       raw_user_meta_data ->> 'username',
       raw_user_meta_data ->> 'full_name'
from auth.users
on conflict (id) do nothing;


-- ---------- 2. Liste de contacts ----------
-- Une ligne = « owner_id a ajouté contact_id à ses contacts ».

create table if not exists public.contacts (
    owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
    contact_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (owner_id, contact_id),
    constraint contacts_not_self check (owner_id <> contact_id)
);

alter table public.contacts enable row level security;

-- Chacun ne voit, n'ajoute et ne retire que ses propres contacts
drop policy if exists "Voir ses contacts" on public.contacts;
create policy "Voir ses contacts"
    on public.contacts for select
    to authenticated
    using (owner_id = auth.uid());

drop policy if exists "Ajouter un contact" on public.contacts;
create policy "Ajouter un contact"
    on public.contacts for insert
    to authenticated
    with check (owner_id = auth.uid());

drop policy if exists "Retirer un contact" on public.contacts;
create policy "Retirer un contact"
    on public.contacts for delete
    to authenticated
    using (owner_id = auth.uid());

grant select, insert, delete on public.contacts to authenticated;
