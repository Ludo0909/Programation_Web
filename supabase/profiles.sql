-- =====================================================================
-- WorkFlow : table des profils publics (page Contacts et messages privés)
-- À exécuter UNE fois dans Supabase : Dashboard > SQL Editor > New query,
-- coller tout ce fichier, puis « Run ».
-- Le script peut être relancé sans danger (if not exists / or replace).
-- =====================================================================

-- Le nom d'utilisateur est gardé dans les métadonnées de Supabase Auth,
-- que le navigateur ne peut pas lire pour les autres comptes. On le copie
-- dans une table « profiles » pour pouvoir lister et chercher les membres.
-- (dm.js lit déjà cette table pour la liste des messages privés.)

create table if not exists public.profiles (
    id         uuid primary key references auth.users (id) on delete cascade,
    username   text,
    full_name  text,
    created_at timestamptz not null default now()
);

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
