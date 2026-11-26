import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const rutaVacantes = '/empresa/vacantes'
const rutaSolicitudes = '/empresa/solicitudes'
const horarios = ['Matutino', 'Vespertino', 'Medio tiempo', 'Fines de semana']
const categorias = ['Atención al cliente', 'Administración']
const estadosSolicitud = ['En revisión', 'Aceptada', 'Rechazada']
const etapas = ['Postulación', 'Revisión', 'Entrevista', 'Decisión']
const nombresEstado = { activa: 'Activa', pausada: 'Pausada', cerrada: 'Cerrada' }
const tiposLogo = ['image/png', 'image/jpeg', 'image/webp']
const formatoFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })

function Campo({ id, etiqueta, children }) {
  return (
    <div className="campo-formulario">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
    </div>
  )
}

function EtiquetaEstatus({ children }) {
  return <p className="etiqueta-estatus"><span className="solo-lector">Estatus: </span>{children}</p>
}

function Aviso({ error, mensaje }) {
  return (
    <>
      {error && <p className="tarjeta tarjeta--alerta" role="alert">{error}</p>}
      {mensaje && <p className="tarjeta tarjeta--aviso" role="status">{mensaje}</p>}
    </>
  )
}

function VolverVacantes() {
  return <Link className="boton boton--secundario" to={rutaVacantes}>Volver a mis vacantes</Link>
}

function useColeccion(cargar, mensajeError) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelada = false
    cargar().then((resultado) => {
      if (!cancelada) setDatos(resultado)
    }).catch(() => {
      if (!cancelada) setError(mensajeError)
    })
    return () => { cancelada = true }
  }, [cargar, mensajeError])

  return { datos, setDatos, error }
}

function telefonoValido(telefono) {
  const digitos = telefono.replace(/\D/g, '').length
  return /^\+?[\d\s().-]+$/.test(telefono) && digitos >= 7 && digitos <= 15
}

function texto(formulario, campo) {
  return String(formulario.get(campo) ?? '').trim()
}

export function EmpresaVacantes() {
  const { perfil } = useAuth()
  const { state } = useLocation()
  const { datos: vacantes, setDatos: setVacantes, error } = useColeccion(
    api.listarVacantesEmpresa, 'No pudimos cargar tus vacantes. Intenta recargar la página.',
  )
  const [cambiando, setCambiando] = useState(false)
  const [confirmarCierre, setConfirmarCierre] = useState(null)
  const [aviso, setAviso] = useState({ mensaje: state?.mensaje })

  async function cambiarEstado(vacante, estado) {
    setCambiando(true)
    setAviso({})
    try {
      await api.cambiarEstadoVacante(vacante.id, estado)
      setVacantes((actuales) => actuales.map((fila) => fila.id === vacante.id ? { ...fila, estado } : fila))
      setConfirmarCierre(null)
      setAviso({ mensaje: 'El estado de la vacante se actualizó.' })
    } catch {
      setAviso({ error: 'No pudimos actualizar el estado de la vacante. Intenta de nuevo.' })
    } finally {
      setCambiando(false)
    }
  }

  return (
    <>
      <h1>Vacantes de mi empresa</h1>
      <p>{perfil.nombre}</p>
      <Link className="boton boton--primario" to={rutaVacantes + '/nueva'}>Publicar vacante</Link>
      <Aviso error={error || aviso.error} mensaje={aviso.mensaje} />
      {!vacantes && !error && <p role="status">Cargando vacantes…</p>}
      {vacantes?.length === 0 && <p>No has publicado vacantes.</p>}
      {vacantes?.map((vacante) => (
        <article className="tarjeta" key={vacante.id}>
          <EtiquetaEstatus>{nombresEstado[vacante.estado]}</EtiquetaEstatus>
          <h2 className="tarjeta__titulo">{vacante.titulo}</h2>
          <p>
            {vacante.creada_en && <>Publicada el {formatoFecha.format(new Date(vacante.creada_en))}<br /></>}
            Solicitudes recibidas: {vacante.total_solicitudes ?? 0}
          </p>
          <div className="grupo-acciones">
            <Link className="boton boton--primario" to={rutaSolicitudes + '?vacante=' + vacante.id}>
              Ver solicitudes<span className="solo-lector"> de {vacante.titulo}</span>
            </Link>
            <Link className="boton boton--secundario" to={rutaVacantes + '/' + vacante.id + '/editar'}>
              Editar<span className="solo-lector"> {vacante.titulo}</span>
            </Link>
          </div>
          {vacante.estado !== 'cerrada' && (
            <div className="grupo-acciones">
              <button className="boton boton--secundario" type="button" disabled={cambiando}
                onClick={() => cambiarEstado(vacante, vacante.estado === 'activa' ? 'pausada' : 'activa')}>
                {vacante.estado === 'activa' ? 'Pausar' : 'Reactivar'}<span className="solo-lector"> {vacante.titulo}</span>
              </button>
              <button className="boton boton--peligro" type="button" disabled={cambiando}
                aria-expanded={confirmarCierre === vacante.id}
                onClick={() => setConfirmarCierre(vacante.id)}>
                Cerrar vacante<span className="solo-lector"> {vacante.titulo}</span>
              </button>
            </div>
          )}
          {confirmarCierre === vacante.id && (
            <section className="tarjeta tarjeta--alerta" aria-label="Confirmación de cierre">
              <h3>¿Quieres cerrar esta vacante?</h3>
              <p>La vacante dejará de aparecer en el listado público.</p>
              <div className="grupo-acciones">
                <button className="boton boton--secundario" type="button" disabled={cambiando} onClick={() => setConfirmarCierre(null)}>
                  Conservar vacante
                </button>
                <button className="boton boton--peligro" type="button" disabled={cambiando} onClick={() => cambiarEstado(vacante, 'cerrada')}>
                  Sí, cerrar vacante
                </button>
              </div>
            </section>
          )}
        </article>
      ))}
    </>
  )
}

function EditorVacante({ original }) {
  const navegar = useNavigate()
  const [llamadas, setLlamadas] = useState(Boolean(original?.telefono_contacto))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const categoriaActual = original?.categoria
  const opcionesCategoria = categoriaActual && !categorias.includes(categoriaActual)
    ? [...categorias, categoriaActual]
    : categorias

  async function guardar(evento) {
    evento.preventDefault()
    const formulario = new FormData(evento.currentTarget)
    const datos = {
      titulo: texto(formulario, 'titulo'),
      sueldo: Number(formulario.get('sueldo')),
      ubicacion: texto(formulario, 'ubicacion'),
      horario: texto(formulario, 'horario'),
      categoria: texto(formulario, 'categoria'),
      descripcion: texto(formulario, 'descripcion'),
      requisitos: texto(formulario, 'requisitos'),
      prestaciones: texto(formulario, 'prestaciones'),
      telefono_contacto: llamadas ? texto(formulario, 'telefono_contacto') : null,
    }
    if (!datos.titulo || !datos.ubicacion || !datos.descripcion || !datos.requisitos || !datos.prestaciones) {
      setError('Completa los campos obligatorios con texto.')
      return
    }
    if (llamadas && !telefonoValido(datos.telefono_contacto)) {
      setError('Escribe un teléfono válido para recibir llamadas.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await api.guardarVacante(datos, original?.id)
      navegar(rutaVacantes, { state: { mensaje: original ? 'Cambios guardados.' : 'Vacante publicada.' } })
    } catch {
      setError('No pudimos guardar la vacante. Revisa los datos e intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="tarjeta formulario" onSubmit={guardar}>
      <div className="fila-campos">
        <Campo id="puesto" etiqueta="Nombre del empleo *">
          <input id="puesto" name="titulo" required defaultValue={original?.titulo} />
        </Campo>
        <Campo id="sueldo" etiqueta="Sueldo mensual en pesos *">
          <input id="sueldo" name="sueldo" type="number" min="0.01" max="99999999.99" step="0.01" required
            defaultValue={original?.sueldo} />
        </Campo>
      </div>
      <div className="fila-campos">
        <Campo id="ubicacion" etiqueta="Ubicación del puesto *">
          <input id="ubicacion" name="ubicacion" required defaultValue={original?.ubicacion} />
        </Campo>
        <Campo id="horario" etiqueta="Horario *">
          <select id="horario" name="horario" required defaultValue={original?.horario ?? ''}>
            <option value="">Elige una opción</option>
            {horarios.map((horario) => <option key={horario}>{horario}</option>)}
          </select>
        </Campo>
      </div>
      <Campo id="categoria" etiqueta="Categoría *">
        <select id="categoria" name="categoria" required defaultValue={categoriaActual ?? ''}>
          <option value="">Elige una opción</option>
          {opcionesCategoria.map((categoria) => <option key={categoria}>{categoria}</option>)}
        </select>
      </Campo>
      <Campo id="descripcion" etiqueta="Descripción *">
        <textarea id="descripcion" name="descripcion" required rows={3} defaultValue={original?.descripcion} />
      </Campo>
      <Campo id="requisitos" etiqueta="Requisitos *">
        <textarea id="requisitos" name="requisitos" required rows={3} defaultValue={original?.requisitos} />
      </Campo>
      <Campo id="prestaciones" etiqueta="Prestaciones *">
        <textarea id="prestaciones" name="prestaciones" required rows={3} defaultValue={original?.prestaciones} />
      </Campo>
      <Campo id="canal" etiqueta="Canal de postulación *">
        <select id="canal" value={llamadas ? 'llamadas' : 'plataforma'}
          onChange={(evento) => setLlamadas(evento.target.value === 'llamadas')}>
          <option value="plataforma">Solo por la plataforma</option>
          <option value="llamadas">Plataforma y teléfono</option>
        </select>
      </Campo>
      {llamadas && (
        <Campo id="telefono-contacto" etiqueta="Teléfono para recibir llamadas *">
          <input id="telefono-contacto" name="telefono_contacto" type="tel" autoComplete="tel"
            required placeholder="81 0000 0000" defaultValue={original?.telefono_contacto ?? ''} />
        </Campo>
      )}
      <Aviso error={error} />
      <button className="boton boton--primario boton--largo" type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : original ? 'Guardar cambios' : 'Guardar y publicar'}
      </button>
    </form>
  )
}

function EditarVacante({ id }) {
  const { datos: vacantes, error } = useColeccion(
    api.listarVacantesEmpresa, 'No pudimos cargar la vacante. Intenta recargar la página.',
  )

  if (error) return <Aviso error={error} />
  if (!vacantes) return <p role="status">Cargando vacante…</p>
  const original = vacantes.find((vacante) => String(vacante.id) === id)
  if (!original) return <p role="alert">No encontramos esta vacante entre las de tu empresa.</p>
  return <EditorVacante key={id} original={original} />
}

export function FormularioVacante() {
  const { id } = useParams()

  return (
    <>
      <VolverVacantes />
      <h1>{id ? 'Editar vacante' : 'Publicar vacante'}</h1>
      <p>Completa la información del puesto. Los campos con * son obligatorios.</p>
      {id ? <EditarVacante id={id} /> : <EditorVacante />}
    </>
  )
}

function SolicitudRecibida({ solicitud, actualizar }) {
  const { id, candidato, vacante, estatus, etapa, estatus_actualizado_en: fechaCambio } = solicitud
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const formulario = new FormData(evento.currentTarget)
    const cambios = { estatus: texto(formulario, 'estatus'), etapa: texto(formulario, 'etapa') }
    setGuardando(true)
    setAviso({})
    try {
      await api.actualizarSolicitud(id, cambios)
    } catch {
      setAviso({ error: 'No pudimos guardar la solicitud. Intenta de nuevo.' })
      setGuardando(false)
      return
    }
    try {
      await actualizar(id)
      setAviso({ mensaje: 'Solicitud actualizada.' })
    } catch {
      setAviso({ mensaje: 'Solicitud actualizada. Recarga la página para ver los cambios.' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <article className="tarjeta">
      <h2 className="tarjeta__titulo">{candidato?.nombre ?? 'Candidato'}</h2>
      <EtiquetaEstatus>{estatus}</EtiquetaEstatus>
      <dl className="lista-datos">
        <div><dt>Vacante</dt><dd>{vacante?.titulo}</dd></div>
        <div><dt>Edad</dt><dd>{candidato?.edad ? candidato.edad + ' años' : 'Sin registrar'}</dd></div>
        <div><dt>Colonia</dt><dd>{candidato?.colonia || 'Sin registrar'}</dd></div>
        <div><dt>Experiencia</dt><dd>{candidato?.experiencia || 'Sin registrar'}</dd></div>
        <div><dt>Etapa actual</dt><dd>{etapa || etapas[0]}</dd></div>
        {fechaCambio && <div><dt>Último cambio de estatus</dt><dd>{formatoFecha.format(new Date(fechaCambio))}</dd></div>}
      </dl>
      {estatus !== 'Cancelada' && (
        <form className="formulario" onSubmit={guardar}>
          <div className="fila-campos">
            <Campo id={'estatus-' + id} etiqueta="Estatus de la solicitud">
              <select id={'estatus-' + id} name="estatus" required
                defaultValue={estadosSolicitud.includes(estatus) ? estatus : ''}>
                <option value="" disabled>Elige un estatus</option>
                {estadosSolicitud.map((estado) => <option key={estado}>{estado}</option>)}
              </select>
            </Campo>
            <Campo id={'etapa-' + id} etiqueta="Etapa de selección">
              <select id={'etapa-' + id} name="etapa" required defaultValue={etapa || etapas[0]}>
                {etapas.map((opcion) => <option key={opcion}>{opcion}</option>)}
              </select>
            </Campo>
          </div>
          <Aviso {...aviso} />
          <button className="boton boton--primario" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>
      )}
    </article>
  )
}

export function SolicitudesRecibidas() {
  const { datos: solicitudes, setDatos: setSolicitudes, error } = useColeccion(
    api.listarSolicitudesRecibidas, 'No pudimos cargar las solicitudes. Intenta recargar la página.',
  )
  const [filtros] = useSearchParams()
  const idVacante = filtros.get('vacante')
  const visibles = idVacante
    ? solicitudes?.filter((solicitud) => String(solicitud.vacante?.id) === idVacante)
    : solicitudes

  async function actualizar(id) {
    const recientes = await api.listarSolicitudesRecibidas()
    const actualizada = recientes.find((solicitud) => solicitud.id === id)
    setSolicitudes((actuales) => actuales.flatMap((solicitud) => {
      if (solicitud.id !== id) return [solicitud]
      return actualizada ? [actualizada] : []
    }))
  }

  return (
    <>
      <VolverVacantes />
      <h1>Solicitudes recibidas</h1>
      {idVacante && <Link className="boton boton--secundario" to={rutaSolicitudes}>Ver todas las solicitudes</Link>}
      <Aviso error={error} />
      {!solicitudes && !error && <p role="status">Cargando solicitudes…</p>}
      {visibles?.length === 0 && <p>No hay solicitudes recibidas.</p>}
      {visibles?.map((solicitud) => (
        <SolicitudRecibida key={solicitud.id} solicitud={solicitud} actualizar={actualizar} />
      ))}
    </>
  )
}

export function PerfilEmpresa() {
  const { perfil, recargarPerfil } = useAuth()
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [avisoPerfil, setAvisoPerfil] = useState({})
  const [avisoLogo, setAvisoLogo] = useState({})

  async function guardar(evento) {
    evento.preventDefault()
    const formulario = new FormData(evento.currentTarget)
    const nombre = texto(formulario, 'nombre')
    const giro = texto(formulario, 'giro')
    const telefono = texto(formulario, 'telefono')
    if (!nombre || !giro || !telefonoValido(telefono)) {
      setAvisoPerfil({ error: 'Escribe el nombre, el giro y un teléfono válido.' })
      return
    }
    setGuardando(true)
    setAvisoPerfil({})
    try {
      await api.actualizarPerfil({ nombre, giro, telefono })
      await recargarPerfil()
      setAvisoPerfil({ mensaje: 'Perfil actualizado.' })
    } catch {
      setAvisoPerfil({ error: 'No pudimos actualizar el perfil. Intenta de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  async function subir(evento) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const archivo = new FormData(formulario).get('logo')
    if (!archivo?.size || !tiposLogo.includes(archivo.type) || archivo.size > 512 * 1024) {
      setAvisoLogo({ error: 'Selecciona una imagen PNG, JPG o WebP de hasta 512 KB.' })
      return
    }
    setSubiendo(true)
    setAvisoLogo({})
    try {
      await api.subirLogo(archivo)
      await recargarPerfil()
      formulario.reset()
      setAvisoLogo({ mensaje: 'Logo actualizado.' })
    } catch {
      setAvisoLogo({ error: 'No pudimos guardar el logo. Intenta de nuevo.' })
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <>
      <VolverVacantes />
      <h1>Perfil de empresa</h1>
      <form className="tarjeta formulario" onSubmit={guardar}>
        <h2 className="tarjeta__titulo">Datos de la empresa</h2>
        <div className="fila-campos">
          <Campo id="empresa-nombre" etiqueta="Nombre de la empresa *">
            <input id="empresa-nombre" name="nombre" autoComplete="organization" required defaultValue={perfil.nombre} />
          </Campo>
          <Campo id="empresa-giro" etiqueta="Giro *">
            <input id="empresa-giro" name="giro" required defaultValue={perfil.giro ?? ''} />
          </Campo>
        </div>
        <Campo id="empresa-telefono" etiqueta="Teléfono *">
          <input id="empresa-telefono" name="telefono" type="tel" autoComplete="tel" required defaultValue={perfil.telefono ?? ''} />
        </Campo>
        <Aviso {...avisoPerfil} />
        <button className="boton boton--primario" type="submit" disabled={guardando || subiendo}>
          {guardando ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </form>
      <form className="tarjeta formulario" onSubmit={subir}>
        <h2 className="tarjeta__titulo">Logo de la empresa</h2>
        {perfil.logo_url && <p><img src={perfil.logo_url} alt={'Logo de ' + perfil.nombre} width="120" /></p>}
        <Campo id="empresa-logo" etiqueta="Elige un archivo de imagen">
          <input id="empresa-logo" name="logo" type="file" accept={tiposLogo.join(',')} required aria-describedby="formatos-logo" />
        </Campo>
        <p id="formatos-logo">Formatos PNG, JPG o WebP. Tamaño máximo de 512 KB.</p>
        <Aviso {...avisoLogo} />
        <button className="boton boton--primario" type="submit" disabled={subiendo || guardando}>
          {subiendo ? 'Subiendo…' : 'Guardar logo'}
        </button>
      </form>
    </>
  )
}

export function Administracion() {
  const { datos: candidatos, setDatos: setCandidatos, error } = useColeccion(
    api.listarCandidatosPendientes, 'No pudimos cargar los candidatos pendientes.',
  )
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState({})

  async function aprobar(candidato) {
    setGuardando(true)
    setAviso({})
    try {
      await api.aprobarCandidato(candidato.id)
      setCandidatos((actuales) => actuales.filter((fila) => fila.id !== candidato.id))
      setAviso({ mensaje: 'Se aprobó la cuenta de ' + candidato.nombre + '.' })
    } catch {
      setAviso({ error: 'No pudimos aprobar al candidato. Intenta de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <h1>Aprobación de candidatos</h1>
      <Aviso error={error || aviso.error} mensaje={aviso.mensaje} />
      {!candidatos && !error && <p role="status">Cargando candidatos…</p>}
      {candidatos?.length === 0 && <p>No hay candidatos pendientes de aprobación.</p>}
      {candidatos?.map((candidato) => (
        <article className="tarjeta" key={candidato.id}>
          <h2 className="tarjeta__titulo">{candidato.nombre}</h2>
          <dl className="lista-datos">
            <div><dt>Edad</dt><dd>{candidato.edad ? candidato.edad + ' años' : 'Sin registrar'}</dd></div>
            <div><dt>Colonia</dt><dd>{candidato.colonia || 'Sin registrar'}</dd></div>
            <div><dt>Experiencia</dt><dd>{candidato.experiencia || 'Sin registrar'}</dd></div>
          </dl>
          <button className="boton boton--primario" type="button" disabled={guardando} onClick={() => aprobar(candidato)}>
            Aprobar<span className="solo-lector"> a {candidato.nombre}</span>
          </button>
        </article>
      ))}
    </>
  )
}
