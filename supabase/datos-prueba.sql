begin;

do $$
begin
  if (
    select count(*) from auth.users u
    join public.perfiles p on p.id = u.id
    where u.email in (
      'empresa-amac@example.com', 'candidato-amac@example.com',
      'pendiente-amac@example.com', 'admin-amac@example.com'
    )
  ) <> 4 then
    raise exception 'Faltan cuentas ficticias de AMAC en Authentication.';
  end if;
end;
$$;

update public.perfiles p
set rol = datos.rol, nombre = datos.nombre, aprobado = datos.aprobado,
    telefono = datos.telefono, edad = datos.edad, colonia = datos.colonia,
    experiencia = datos.experiencia, giro = datos.giro
from (
  values
    ('empresa-amac@example.com', 'empresa', 'Comercio Ejemplo', false, '8100000000', null, null, null, 'Servicios'),
    ('candidato-amac@example.com', 'candidato', 'Carlos Martínez', true, '8100000001', 66, 'Centro', 'Atención al cliente', null),
    ('pendiente-amac@example.com', 'candidato', 'Rosa Pérez', false, '8100000002', 61, 'San Nicolás', 'Auxiliar administrativa', null),
    ('admin-amac@example.com', 'admin', 'Administración AMAC', false, null, null, null, null, null)
) datos(correo, rol, nombre, aprobado, telefono, edad, colonia, experiencia, giro)
join auth.users u on u.email = datos.correo
where p.id = u.id;

insert into public.vacantes
  (empresa_id, titulo, sueldo, ubicacion, horario, categoria, descripcion, requisitos, prestaciones, telefono_contacto)
select u.id, v.titulo, v.sueldo, v.ubicacion, v.horario, v.categoria,
       'Apoya al equipo en las actividades diarias del puesto.',
       'Disponibilidad en el horario indicado y trato amable.',
       'Capacitación y prestaciones de ley.', v.telefono
from auth.users u
cross join (
  values
    ('Auxiliar de atención', 6400, 'Monterrey Centro', 'Medio tiempo', 'Atención al cliente', null),
    ('Capturista de datos', 7200, 'San Nicolás', 'Matutino', 'Administración', null),
    ('Asistente de archivo', 6800, 'Guadalupe', 'Vespertino', 'Administración', null),
    ('Anfitrión de tienda', 4500, 'San Pedro', 'Fines de semana', 'Atención al cliente', '8100000000'),
    ('Recepcionista', 8600, 'Monterrey', 'Matutino', 'Atención al cliente', null),
    ('Asesor de piso', 7300, 'Apodaca', 'Medio tiempo', 'Atención al cliente', null)
) v(titulo, sueldo, ubicacion, horario, categoria, telefono)
where u.email = 'empresa-amac@example.com'
and not exists (
  select 1 from public.vacantes anterior
  where anterior.empresa_id = u.id and anterior.titulo = v.titulo
);

commit;
