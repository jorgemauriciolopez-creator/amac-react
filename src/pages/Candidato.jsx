import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const filtrosVacios = { busqueda: '', horario: '', categoria: '' }
const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2, minimumFractionDigits: 0 })
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })
const cargarVacantes = () => api.listarVacantes()
const cargarVacante = (id) => api.obtenerVacante(id)
const cargarSolicitudes = () => api.listarMisSolicitudes()
const cargarFavoritas = (candidatoId) => candidatoId ? api.listarFavoritas() : Promise.resolve([])

function useConsulta(cargar, parametro) {
  const [consulta, cambiarConsulta] = useState(null)

  useEffect(() => {
    let vigente = true
    async function consultar() {
      try {
        const datos = await cargar(parametro)
        if (vigente) cambiarConsulta({ parametro, datos, fallo: false })
      } catch {
        if (vigente) cambiarConsulta({ parametro, datos: null, fallo: true })
      }
    }
    consultar()
    return () => { vigente = false }
  }, [cargar, parametro])

  return [consulta?.parametro === parametro ? consulta : null, cambiarConsulta]
}

function TarjetaVacante({ vacante, tituloNivel: Titulo = 'h3', children }) {
  return (
    <article className="tarjeta tarjeta-vacante">
      <p className="tarjeta-vacante__horario">{vacante.horario}</p>
      <Titulo className="tarjeta__titulo">{vacante.titulo}</Titulo>
      <p className="tarjeta-vacante__empresa">{vacante.empresa?.nombre}</p>
      <ul className="tarjeta-vacante__datos">
        <li><span className="solo-lector">Sueldo: </span>{moneda.format(vacante.sueldo)} al mes</li>
        <li><span className="solo-lector">Ubicación: </span>{vacante.ubicacion}</li>
        <li><span className="solo-lector">Categoría: </span>{vacante.categoria}</li>
      </ul>
      <Link className="boton boton--primario" to={`/vacantes/${vacante.id}`}>
        Ver vacante<span className="solo-lector">: {vacante.titulo}</span>
      </Link>
      {children}
    </article>
  )
}

export function ListadoVacantes() {
  const [consulta] = useConsulta(cargarVacantes)
  const [campos, cambiarCampos] = useState(filtrosVacios)
  const [filtros, cambiarFiltros] = useState(filtrosVacios)
  const vacantes = consulta?.datos ?? []
  const horarios = [...new Set(vacantes.map((vacante) => vacante.horario))].sort()
  const categorias = [...new Set(vacantes.map((vacante) => vacante.categoria))].sort()
  const palabra = filtros.busqueda.trim().toLocaleLowerCase('es-MX')
  const resultados = vacantes.filter((vacante) =>
    (!palabra || [vacante.titulo, vacante.ubicacion, vacante.empresa?.nombre]
      .some((campo) => campo?.toLocaleLowerCase('es-MX').includes(palabra))) &&
    (!filtros.horario || vacante.horario === filtros.horario) &&
    (!filtros.categoria || vacante.categoria === filtros.categoria)
  )
  const hayFiltros = Boolean(palabra || filtros.horario || filtros.categoria)

  function editarCampo(evento) {
    const { name, value } = evento.target
    cambiarCampos((anteriores) => ({ ...anteriores, [name]: value }))
  }

  function buscar(evento) {
    evento.preventDefault()
    cambiarFiltros(campos)
  }

  function limpiar() {
    cambiarCampos(filtrosVacios)
    cambiarFiltros(filtrosVacios)
  }

  return (
    <>
      <h1>Vacantes disponibles</h1>
      <p>Encuentra oportunidades activas en Monterrey y su área metropolitana.</p>
      <section className="tarjeta tarjeta--aviso" aria-labelledby="titulo-buscar">
        <h2 id="titulo-buscar">Buscar y filtrar</h2>
        <form className="formulario" onSubmit={buscar}>
          <div className="busqueda">
            <div className="campo-formulario">
              <label htmlFor="busqueda">Puesto, empresa o ubicación</label>
              <input type="search" id="busqueda" name="busqueda" placeholder="Escribe una palabra" value={campos.busqueda} onChange={editarCampo} />
            </div>
            <div className="busqueda__filtros">
              <div className="campo-formulario">
                <label htmlFor="horario">Horario</label>
                <select id="horario" name="horario" value={campos.horario} onChange={editarCampo}>
                  <option value="">Todos</option>
                  {horarios.map((horario) => <option key={horario}>{horario}</option>)}
                </select>
              </div>
              <div className="campo-formulario">
                <label htmlFor="categoria">Categoría</label>
                <select id="categoria" name="categoria" value={campos.categoria} onChange={editarCampo}>
                  <option value="">Todas</option>
                  {categorias.map((categoria) => <option key={categoria}>{categoria}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="grupo-acciones">
            <button className="boton boton--primario" type="submit">Buscar</button>
            <button className="boton boton--secundario" type="button" onClick={limpiar}>Limpiar filtros</button>
          </div>
        </form>
      </section>
      {!consulta && <p role="status">Cargando vacantes...</p>}
      {consulta?.fallo && <p role="alert">No se pudieron cargar las vacantes. Vuelve a intentarlo.</p>}
      {consulta?.datos && (
        <>
          <h2 aria-live="polite">
            {resultados.length === 0 && 'No hay vacantes para mostrar'}
            {resultados.length === 1 && (hayFiltros ? '1 vacante encontrada' : '1 vacante disponible')}
            {resultados.length > 1 && `${resultados.length} vacantes ${hayFiltros ? 'encontradas' : 'disponibles'}`}
          </h2>
          <div className="lista-vacantes">
            {resultados.map((vacante) => <TarjetaVacante key={vacante.id} vacante={vacante} />)}
          </div>
        </>
      )}
    </>
  )
}

export function DetalleVacante() {
  const { id } = useParams()
  return <ContenidoVacante key={id} id={id} />
}

function ContenidoVacante({ id }) {
  const { perfil } = useAuth()
  const candidato = perfil?.rol === 'candidato'
  const [consulta] = useConsulta(cargarVacante, id)
  const [favoritas, cambiarFavoritas] = useConsulta(cargarFavoritas, candidato ? perfil.id : null)
  const [confirmando, cambiarConfirmacion] = useState(false)
  const [ocupado, cambiarOcupado] = useState(false)
  const [postulada, cambiarPostulada] = useState(false)
  const [mensaje, cambiarMensaje] = useState(null)
  const vacante = consulta?.datos
  const marcada = favoritas?.datos?.some((favorita) => String(favorita.id) === id) ?? false
  const telefono = vacante?.telefono_contacto?.trim()
  const numero = telefono?.replace(/[^\d+]/g, '')

  async function postular() {
    if (ocupado) return
    cambiarOcupado(true)
    cambiarMensaje(null)
    try {
      await api.postular(id)
      cambiarPostulada(true)
      cambiarConfirmacion(false)
      cambiarMensaje({ texto: '¡Listo! Tu solicitud fue enviada.' })
    } catch (error) {
      if (error?.code === '23505') {
        cambiarPostulada(true)
        cambiarConfirmacion(false)
        cambiarMensaje({ texto: 'Ya te postulaste a esta vacante.' })
      } else {
        cambiarMensaje({ error: true, texto: error?.code === '42501'
          ? 'No se pudo enviar la solicitud. Verifica que tu cuenta esté aprobada y la vacante siga activa.'
          : 'No se pudo enviar tu solicitud. Vuelve a intentarlo.' })
      }
    } finally {
      cambiarOcupado(false)
    }
  }

  async function guardarFavorita() {
    if (ocupado || favoritas?.fallo || !favoritas?.datos) return
    cambiarOcupado(true)
    cambiarMensaje(null)
    try {
      await api.cambiarFavorita(id, !marcada)
      cambiarFavoritas((actual) => ({
        ...actual,
        datos: marcada ? actual.datos.filter((favorita) => String(favorita.id) !== id) : [...actual.datos, vacante],
      }))
      cambiarMensaje({ texto: marcada ? 'Vacante eliminada de tus favoritas.' : 'Vacante guardada en tus favoritas.' })
    } catch {
      cambiarMensaje({ error: true, texto: 'No se pudo actualizar tu lista de favoritas. Vuelve a intentarlo.' })
    } finally {
      cambiarOcupado(false)
    }
  }

  if (!vacante) {
    return (
      <>
        <Link className="boton boton--secundario boton--corto" to="/">Volver a vacantes</Link>
        <h1>Detalle de vacante</h1>
        {!consulta && <p role="status">Cargando vacante...</p>}
        {consulta?.fallo && <p role="alert">No se pudo cargar la vacante. Vuelve a intentarlo.</p>}
        {consulta && !consulta.fallo && <p>Esta vacante no está disponible.</p>}
      </>
    )
  }

  const activa = vacante.estado === 'activa'
  const nombreEmpresa = vacante.empresa?.nombre
  const logo = vacante.empresa?.logo_url

  return (
    <>
      <Link className="boton boton--secundario boton--corto" to="/">Volver a vacantes</Link>
      <h1>{vacante.titulo}</h1>
      <p>{nombreEmpresa}</p>
      <section className="tarjeta" aria-label="Información de la vacante">
        {logo && <div className="logo"><img src={logo} alt="" /></div>}
        <p className="etiqueta-estatus">{vacante.horario}</p>
        <dl className="lista-datos">
          <div><dt>Sueldo</dt><dd>{moneda.format(vacante.sueldo)} al mes</dd></div>
          <div><dt>Ubicación</dt><dd>{vacante.ubicacion}</dd></div>
          <div><dt>Horario y categoría</dt><dd>{vacante.horario}<br />{vacante.categoria}</dd></div>
          <div><dt>Descripción</dt><dd>{vacante.descripcion}</dd></div>
          <div><dt>Requisitos</dt><dd>{vacante.requisitos}</dd></div>
          <div><dt>Prestaciones</dt><dd>{vacante.prestaciones}</dd></div>
          <div><dt>Estado</dt><dd>{vacante.estado === 'activa' ? 'Activa' : vacante.estado === 'pausada' ? 'Pausada' : 'Cerrada'}</dd></div>
        </dl>
        {activa && <p>{numero ? `Esta vacante recibe solicitudes por la plataforma y por teléfono: ${telefono}.` : 'Esta vacante recibe solicitudes únicamente por la plataforma.'}</p>}
      </section>
      {activa && candidato && !perfil.aprobado && (
        <p className="tarjeta tarjeta--alerta">Tu registro aún no ha sido aprobado por AMAC. Podrás postularte cuando esté aprobado.</p>
      )}
      <div className="grupo-acciones">
        {activa && !perfil && (
          <Link className="boton boton--primario" to="/login" state={{ desde: `/vacantes/${id}` }}>Inicia sesión para postularte</Link>
        )}
        {activa && candidato && perfil.aprobado && !postulada && !confirmando && (
          <button className="boton boton--primario" type="button" disabled={ocupado} onClick={() => { cambiarMensaje(null); cambiarConfirmacion(true) }}>Postularme</button>
        )}
        {activa && numero && (
          <a className="boton boton--secundario" href={`tel:${numero}`}>Llamar<span className="solo-lector"> a {nombreEmpresa}</span></a>
        )}
        {candidato && (activa || marcada) && (
          <button className="boton boton--secundario" type="button" disabled={ocupado || !favoritas?.datos} onClick={guardarFavorita}>
            {marcada ? 'Quitar de favoritas' : 'Guardar en favoritas'}
          </button>
        )}
      </div>
      {favoritas?.fallo && <p role="alert">No se pudieron cargar tus favoritas.</p>}
      {confirmando && (
        <section className="tarjeta" aria-labelledby="confirmar-postulacion">
          <h2 id="confirmar-postulacion">¿Enviar tu solicitud?</h2>
          <p>La empresa podrá consultar tu perfil y tu experiencia.</p>
          <div className="grupo-acciones">
            <button className="boton boton--primario" type="button" disabled={ocupado} onClick={postular}>Sí, postularme</button>
            <button className="boton boton--secundario" type="button" disabled={ocupado} onClick={() => cambiarConfirmacion(false)}>Volver al detalle</button>
          </div>
        </section>
      )}
      {mensaje && <p className={`tarjeta ${mensaje.error ? 'tarjeta--alerta' : 'tarjeta--aviso'}`} role={mensaje.error ? 'alert' : 'status'}>{mensaje.texto}</p>}
      {postulada && <Link className="boton boton--secundario" to="/mis-solicitudes">Ver mis solicitudes</Link>}
    </>
  )
}

export function MisSolicitudes() {
  const { perfil } = useAuth()
  const [consulta, cambiarConsulta] = useConsulta(cargarSolicitudes, perfil?.id)
  const [confirmarId, cambiarConfirmarId] = useState(null)
  const [ocupado, cambiarOcupado] = useState(false)
  const [mensaje, cambiarMensaje] = useState(null)

  async function cancelar(solicitudId) {
    if (ocupado) return
    cambiarOcupado(true)
    cambiarMensaje(null)
    try {
      const actualizada = await api.cancelarSolicitud(solicitudId)
      cambiarConsulta((actual) => ({
        ...actual,
        datos: actual.datos.map((solicitud) => solicitud.id === solicitudId
          ? {
            ...solicitud,
            estatus: 'Cancelada',
            estatus_actualizado_en: actualizada?.estatus_actualizado_en ?? new Date().toISOString(),
          }
          : solicitud),
      }))
      cambiarConfirmarId(null)
      cambiarMensaje({ texto: 'Tu solicitud fue cancelada.' })
    } catch {
      cambiarMensaje({ error: true, texto: 'No se pudo cancelar la solicitud. Verifica que siga pendiente e inténtalo de nuevo.' })
    } finally {
      cambiarOcupado(false)
    }
  }

  return (
    <>
      <h1>Mis solicitudes</h1>
      <p>Consulta la fecha y el estado de tus postulaciones.</p>
      {!consulta && <p role="status">Cargando solicitudes...</p>}
      {consulta?.fallo && <p role="alert">No se pudieron cargar tus solicitudes. Vuelve a intentarlo.</p>}
      {consulta?.datos?.length === 0 && <p>Todavía no tienes solicitudes.</p>}
      {mensaje && <p className={`tarjeta ${mensaje.error ? 'tarjeta--alerta' : 'tarjeta--aviso'}`} role={mensaje.error ? 'alert' : 'status'}>{mensaje.texto}</p>}
      {consulta?.datos?.map((solicitud) => {
        const { id, vacante, estatus, etapa, creada_en, estatus_actualizado_en } = solicitud
        const titulo = vacante?.titulo ?? 'Vacante sin datos'
        const puedeCancelar = estatus === 'Enviada' || estatus === 'En revisión'
        return (
          <article className="tarjeta" key={id}>
            <p className="etiqueta-estatus"><span className="solo-lector">Estatus: </span>{estatus}</p>
            <h2 className="tarjeta__titulo">{titulo}</h2>
            {vacante?.empresa?.nombre && <p className="negrita">{vacante.empresa.nombre}</p>}
            <p>Fecha de postulación: <time dateTime={creada_en}>{fecha.format(new Date(creada_en))}</time></p>
            {etapa && <p>Etapa: {etapa}</p>}
            {estatus_actualizado_en && <p>Último cambio de estatus: <time dateTime={estatus_actualizado_en}>{fecha.format(new Date(estatus_actualizado_en))}</time></p>}
            {estatus === 'Aceptada' && <p>La empresa aceptó tu solicitud.</p>}
            {estatus === 'Rechazada' && <p>La empresa cerró esta solicitud.</p>}
            {puedeCancelar && confirmarId !== id && (
              <button className="boton boton--peligro" type="button" disabled={ocupado} onClick={() => { cambiarMensaje(null); cambiarConfirmarId(id) }}>
                Cancelar solicitud<span className="solo-lector">: {titulo}</span>
              </button>
            )}
            {puedeCancelar && confirmarId === id && (
              <section aria-labelledby={`cancelar-${id}`}>
                <h3 id={`cancelar-${id}`}>¿Cancelar esta solicitud?</h3>
                <p>Si continúas, tu solicitud dejará de estar activa para la empresa.</p>
                <div className="grupo-acciones">
                  <button className="boton boton--secundario" type="button" disabled={ocupado} onClick={() => cambiarConfirmarId(null)}>Conservar solicitud</button>
                  <button className="boton boton--peligro" type="button" disabled={ocupado} onClick={() => cancelar(id)}>Sí, cancelar</button>
                </div>
              </section>
            )}
          </article>
        )
      })}
      <Link className="boton boton--secundario" to="/">Buscar más vacantes</Link>
    </>
  )
}

export function Favoritas() {
  const { perfil } = useAuth()
  const [consulta, cambiarConsulta] = useConsulta(cargarFavoritas, perfil?.id)
  const [ocupado, cambiarOcupado] = useState(false)
  const [mensaje, cambiarMensaje] = useState(null)

  async function quitar(id) {
    cambiarOcupado(true)
    cambiarMensaje(null)
    try {
      await api.cambiarFavorita(id, false)
      cambiarConsulta((actual) => ({
        ...actual,
        datos: actual.datos.filter((vacante) => vacante.id !== id),
      }))
      cambiarMensaje({ texto: 'Vacante eliminada de tus favoritas.' })
    } catch {
      cambiarMensaje({ error: true, texto: 'No se pudo quitar la vacante de tus favoritas. Vuelve a intentarlo.' })
    } finally {
      cambiarOcupado(false)
    }
  }

  return (
    <>
      <h1>Vacantes favoritas</h1>
      {!consulta && <p role="status">Cargando favoritas...</p>}
      {consulta?.fallo && <p role="alert">No se pudieron cargar tus favoritas. Vuelve a intentarlo.</p>}
      {consulta?.datos?.length === 0 && <p>Todavía no tienes vacantes favoritas.</p>}
      {mensaje && <p role={mensaje.error ? 'alert' : 'status'}>{mensaje.texto}</p>}
      <div className="lista-vacantes">
        {consulta?.datos?.map((vacante) => (
          <TarjetaVacante key={vacante.id} vacante={vacante} tituloNivel="h2">
            <button className="boton boton--secundario" type="button" disabled={ocupado} onClick={() => quitar(vacante.id)}>
              Quitar de favoritas<span className="solo-lector">: {vacante.titulo}</span>
            </button>
          </TarjetaVacante>
        ))}
      </div>
      <Link className="boton boton--secundario" to="/">Buscar más vacantes</Link>
    </>
  )
}

export function PerfilCandidato() {
  const { perfil, recargarPerfil } = useAuth()
  const [ocupado, cambiarOcupado] = useState(false)
  const [mensaje, cambiarMensaje] = useState(null)

  async function guardar(evento) {
    evento.preventDefault()
    if (ocupado) return
    const campos = new FormData(evento.currentTarget)
    const datos = {
      nombre: campos.get('nombre').trim(),
      telefono: campos.get('telefono').trim(),
      edad: Number(campos.get('edad')),
      colonia: campos.get('colonia').trim(),
      experiencia: campos.get('experiencia').trim(),
    }
    if (!datos.nombre || !datos.telefono || !datos.colonia || !datos.experiencia) {
      cambiarMensaje({ error: true, texto: 'Completa todos los campos para guardar tu perfil.' })
      return
    }
    cambiarOcupado(true)
    cambiarMensaje(null)
    try {
      await api.actualizarPerfil(datos)
      await recargarPerfil()
      cambiarMensaje({ texto: 'Tu perfil fue actualizado.' })
    } catch {
      cambiarMensaje({ error: true, texto: 'No se pudo actualizar tu perfil. Vuelve a intentarlo.' })
    } finally {
      cambiarOcupado(false)
    }
  }

  return (
    <>
      <h1>Mi perfil</h1>
      {perfil && (
        <>
          {!perfil.aprobado && <p className="tarjeta tarjeta--alerta">Tu cuenta está pendiente de aprobación por AMAC.</p>}
          <form className="tarjeta formulario" onSubmit={guardar} key={perfil.id}>
            <div className="fila-campos">
              <div className="campo-formulario">
                <label htmlFor="perfil-nombre">Nombre completo</label>
                <input id="perfil-nombre" name="nombre" autoComplete="name" defaultValue={perfil.nombre ?? ''} required />
              </div>
              <div className="campo-formulario">
                <label htmlFor="perfil-telefono">Teléfono</label>
                <input id="perfil-telefono" name="telefono" type="tel" autoComplete="tel" defaultValue={perfil.telefono ?? ''} required />
              </div>
              <div className="campo-formulario">
                <label htmlFor="perfil-edad">Edad</label>
                <input id="perfil-edad" name="edad" type="number" min="18" max="120" defaultValue={perfil.edad ?? ''} required />
              </div>
              <div className="campo-formulario">
                <label htmlFor="perfil-colonia">Colonia</label>
                <input id="perfil-colonia" name="colonia" defaultValue={perfil.colonia ?? ''} required />
              </div>
            </div>
            <div className="campo-formulario">
              <label htmlFor="perfil-experiencia">Experiencia laboral</label>
              <textarea id="perfil-experiencia" name="experiencia" rows="3" defaultValue={perfil.experiencia ?? ''} required />
            </div>
            <button className="boton boton--primario" type="submit" disabled={ocupado}>{ocupado ? 'Guardando...' : 'Guardar cambios'}</button>
          </form>
          {mensaje && <p role={mensaje.error ? 'alert' : 'status'}>{mensaje.texto}</p>}
        </>
      )}
    </>
  )
}
