-- AMAC · Entrega 3
-- Ejecutar una vez en el SQL Editor de un proyecto Supabase nuevo.
begin;

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'candidato' check (rol in ('candidato', 'empresa', 'admin')),
  nombre text not null check (btrim(nombre) <> ''),
  telefono text,
  edad integer check (edad between 18 and 120),
  colonia text,
  experiencia text,
  giro text,
  aprobado boolean not null default false,
  logo_url text check (logo_url is null or rol = 'empresa'),
  creado_en timestamptz not null default now()
);

create table public.vacantes (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.perfiles(id) on delete cascade,
  titulo text not null check (btrim(titulo) <> ''),
  sueldo numeric(10, 2) not null check (sueldo > 0 and sueldo <> 'NaN'::numeric),
  ubicacion text not null check (btrim(ubicacion) <> ''),
  horario text not null check (horario in ('Matutino', 'Vespertino', 'Medio tiempo', 'Fines de semana')),
  categoria text not null check (btrim(categoria) <> ''),
  descripcion text not null check (btrim(descripcion) <> ''),
  requisitos text not null check (btrim(requisitos) <> ''),
  prestaciones text not null check (btrim(prestaciones) <> ''),
  -- Sin teléfono público, la postulación se hace por la plataforma.
  telefono_contacto text check (
    telefono_contacto is null or (
      telefono_contacto ~ '^[+]?[0-9(). -]+$'
      and length(regexp_replace(telefono_contacto, '[^0-9]', '', 'g')) between 7 and 15
    )
  ),
  estado text not null default 'activa' check (estado in ('activa', 'pausada', 'cerrada')),
  creada_en timestamptz not null default now()
);

create table public.solicitudes (
  id bigint generated always as identity primary key,
  vacante_id bigint not null references public.vacantes(id) on delete cascade,
  candidato_id uuid not null references public.perfiles(id) on delete cascade,
  estatus text not null default 'Enviada'
    check (estatus in ('Enviada', 'En revisión', 'Aceptada', 'Rechazada', 'Cancelada')),
  etapa text not null default 'Postulación'
    check (etapa in ('Postulación', 'Revisión', 'Entrevista', 'Decisión')),
  estatus_actualizado_en timestamptz,
  creada_en timestamptz not null default now(),
  unique (vacante_id, candidato_id)
);

create table public.favoritas (
  candidato_id uuid not null references public.perfiles(id) on delete cascade,
  vacante_id bigint not null references public.vacantes(id) on delete cascade,
  creada_en timestamptz not null default now(),
  primary key (candidato_id, vacante_id)
);

create index vacantes_empresa_idx on public.vacantes (empresa_id);
create index solicitudes_candidato_idx on public.solicitudes (candidato_id);
create index favoritas_vacante_idx on public.favoritas (vacante_id);

-- Auth conserva el correo y la contraseña. El trigger guarda solo el perfil.
create function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  datos jsonb := new.raw_user_meta_data;
  es_empresa boolean := coalesce(datos->>'rol' = 'empresa', false);
begin
  insert into public.perfiles (id, rol, nombre, telefono, edad, colonia, experiencia, giro)
  values (
    new.id,
    case when es_empresa then 'empresa' else 'candidato' end,
    coalesce(nullif(btrim(datos->>'nombre'), ''), 'Sin nombre'),
    nullif(btrim(datos->>'telefono'), ''),
    case when not es_empresa then nullif(datos->>'edad', '')::integer end,
    case when not es_empresa then nullif(btrim(datos->>'colonia'), '') end,
    case when not es_empresa then nullif(btrim(datos->>'experiencia'), '') end,
    case when es_empresa then nullif(btrim(datos->>'giro'), '') end
  );
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Consultan el contexto del usuario sin hacer que las políticas RLS se llamen entre sí.
create function public.mi_rol()
returns text language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = (select auth.uid());
$$;

create function public.candidato_aprobado()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'candidato' and aprobado
  );
$$;

create function public.candidato_aplico(vid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.solicitudes
    where vacante_id = vid and candidato_id = (select auth.uid())
  );
$$;

create function public.empresa_ve_candidato(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.solicitudes s
    join public.vacantes v on v.id = s.vacante_id
    where s.candidato_id = cid and v.empresa_id = (select auth.uid())
  );
$$;

-- La vista solo expone los datos de empresa que se muestran en una vacante.
create view public.empresas_publicas as
  select id, nombre, logo_url from public.perfiles where rol = 'empresa';

-- Relación de PostgREST para consultar el nombre y logo con cada vacante.
create function public.empresa(vacante public.vacantes)
returns setof public.empresas_publicas rows 1
language sql stable set search_path = '' as $$
  select e.* from public.empresas_publicas e where e.id = vacante.empresa_id;
$$;

create function public.anotar_cambio_de_estatus()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estatus = 'Cancelada' then
    new.etapa := old.etapa;
  end if;
  if new.estatus is distinct from old.estatus then
    new.estatus_actualizado_en := now();
  end if;
  return new;
end;
$$;

create trigger cambio_de_estatus before update on public.solicitudes
  for each row execute function public.anotar_cambio_de_estatus();

create function public.impedir_reapertura()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.estado = 'cerrada' and new.estado <> 'cerrada' then
    raise exception 'La vacante ya está cerrada.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger impedir_reapertura before update of estado on public.vacantes
  for each row execute function public.impedir_reapertura();

-- La primera cuenta admin se promueve en el SQL Editor por el equipo.
-- El registro público solo asigna los roles candidato y empresa.
create function public.listar_candidatos_pendientes()
returns table (id uuid, nombre text, telefono text, edad integer, colonia text, experiencia text, creado_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.mi_rol() is distinct from 'admin' then
    raise exception 'Solo AMAC puede revisar candidatos.' using errcode = '42501';
  end if;
  return query
    select p.id, p.nombre, p.telefono, p.edad, p.colonia, p.experiencia, p.creado_en
    from public.perfiles p
    where p.rol = 'candidato' and not p.aprobado
    order by p.creado_en;
end;
$$;

create function public.aprobar_candidato(candidato uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.mi_rol() is distinct from 'admin' then
    raise exception 'Solo AMAC puede aprobar candidatos.' using errcode = '42501';
  end if;
  update public.perfiles set aprobado = true where id = candidato and rol = 'candidato';
  if not found then
    raise exception 'No se encontró al candidato.' using errcode = 'P0002';
  end if;
end;
$$;

alter table public.perfiles enable row level security;
alter table public.vacantes enable row level security;
alter table public.solicitudes enable row level security;
alter table public.favoritas enable row level security;

-- Se declaran los permisos de tablas y columnas además de las reglas por fila.
revoke all on public.perfiles, public.vacantes, public.solicitudes, public.favoritas,
  public.empresas_publicas from public, anon, authenticated;
grant select on public.vacantes, public.empresas_publicas to anon, authenticated;
grant select on public.perfiles, public.solicitudes, public.favoritas to authenticated;
grant update (nombre, telefono, edad, colonia, experiencia, giro, logo_url) on public.perfiles to authenticated;
grant insert (empresa_id, titulo, sueldo, ubicacion, horario, categoria, descripcion,
  requisitos, prestaciones, telefono_contacto) on public.vacantes to authenticated;
grant update (titulo, sueldo, ubicacion, horario, categoria, descripcion,
  requisitos, prestaciones, telefono_contacto, estado) on public.vacantes to authenticated;
grant insert (vacante_id, candidato_id) on public.solicitudes to authenticated;
grant update (estatus, etapa) on public.solicitudes to authenticated;
grant insert (vacante_id, candidato_id), delete on public.favoritas to authenticated;
grant usage on sequence public.vacantes_id_seq, public.solicitudes_id_seq to authenticated;

revoke execute on function public.crear_perfil(), public.mi_rol(), public.candidato_aprobado(),
  public.candidato_aplico(bigint), public.empresa_ve_candidato(uuid), public.empresa(public.vacantes),
  public.anotar_cambio_de_estatus(), public.impedir_reapertura(), public.listar_candidatos_pendientes(),
  public.aprobar_candidato(uuid) from public, anon, authenticated;
grant execute on function public.mi_rol(), public.candidato_aprobado(), public.candidato_aplico(bigint),
  public.empresa_ve_candidato(uuid), public.listar_candidatos_pendientes(), public.aprobar_candidato(uuid)
  to authenticated;
grant execute on function public.empresa(public.vacantes) to anon, authenticated;

create policy "Cada quien ve su perfil" on public.perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy "La empresa ve quien se postuló a sus vacantes" on public.perfiles for select to authenticated
  using (rol = 'candidato' and (select public.mi_rol()) = 'empresa' and public.empresa_ve_candidato(id));

create policy "Cada quien edita su perfil" on public.perfiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "El público ve las vacantes activas" on public.vacantes for select to anon, authenticated
  using (estado = 'activa');

create policy "La empresa ve sus propias vacantes" on public.vacantes for select to authenticated
  using (empresa_id = (select auth.uid()));

create policy "El candidato sigue viendo las vacantes a las que aplicó" on public.vacantes for select to authenticated
  using (public.candidato_aplico(id));

create policy "Solo empresas publican a su nombre" on public.vacantes for insert to authenticated
  with check (empresa_id = (select auth.uid()) and (select public.mi_rol()) = 'empresa');

create policy "La empresa edita sus vacantes" on public.vacantes for update to authenticated
  using (empresa_id = (select auth.uid()) and (select public.mi_rol()) = 'empresa')
  with check (empresa_id = (select auth.uid()) and (select public.mi_rol()) = 'empresa');

create policy "El candidato ve sus solicitudes" on public.solicitudes for select to authenticated
  using (candidato_id = (select auth.uid()));

create policy "La empresa ve solicitudes de sus vacantes" on public.solicitudes for select to authenticated
  using (exists (
    select 1 from public.vacantes v where v.id = vacante_id and v.empresa_id = (select auth.uid())
  ));

create policy "Solo candidatos aprobados se postulan a vacantes activas" on public.solicitudes for insert to authenticated
  with check (
    candidato_id = (select auth.uid()) and estatus = 'Enviada' and (select public.candidato_aprobado())
    and exists (select 1 from public.vacantes v where v.id = vacante_id and v.estado = 'activa')
  );

create policy "El candidato cancela solicitudes pendientes" on public.solicitudes for update to authenticated
  using (candidato_id = (select auth.uid()) and estatus in ('Enviada', 'En revisión'))
  with check (candidato_id = (select auth.uid()) and estatus = 'Cancelada');

create policy "La empresa actualiza sus solicitudes" on public.solicitudes for update to authenticated
  using (estatus <> 'Cancelada' and exists (
    select 1 from public.vacantes v where v.id = vacante_id and v.empresa_id = (select auth.uid())
  ))
  with check (estatus in ('Enviada', 'En revisión', 'Aceptada', 'Rechazada') and exists (
    select 1 from public.vacantes v where v.id = vacante_id and v.empresa_id = (select auth.uid())
  ));

create policy "El candidato ve sus favoritas" on public.favoritas for select to authenticated
  using (candidato_id = (select auth.uid()));

create policy "El candidato guarda sus favoritas activas" on public.favoritas for insert to authenticated
  with check (
    candidato_id = (select auth.uid()) and (select public.mi_rol()) = 'candidato'
    and exists (select 1 from public.vacantes v where v.id = vacante_id and v.estado = 'activa')
  );

create policy "El candidato quita sus favoritas" on public.favoritas for delete to authenticated
  using (candidato_id = (select auth.uid()));

-- El bucket sirve imágenes públicas. La ruta de escritura empieza con el id de la empresa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos-empresa', 'logos-empresa', true, 2097152, array['image/gif', 'image/jpeg', 'image/png', 'image/webp']);

create policy "La empresa puede consultar sus propios logos" on storage.objects for select to authenticated
  using (
    bucket_id = 'logos-empresa' and (select public.mi_rol()) = 'empresa'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "La empresa sube su logo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos-empresa' and (select public.mi_rol()) = 'empresa'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "La empresa reemplaza su logo" on storage.objects for update to authenticated
  using (
    bucket_id = 'logos-empresa' and (select public.mi_rol()) = 'empresa'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'logos-empresa' and (select public.mi_rol()) = 'empresa'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "La empresa borra su logo" on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos-empresa' and (select public.mi_rol()) = 'empresa'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
