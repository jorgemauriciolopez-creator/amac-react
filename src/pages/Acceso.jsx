import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, modoDemo } from '../lib/api'
import { cuentasDemo, contrasenaDemo } from '../lib/demo'

function Campo({ nombre, etiqueta, ...props }) {
  return (
    <div className="campo-formulario">
      <label htmlFor={nombre}>{etiqueta}</label>
      <input id={nombre} name={nombre} required {...props} />
    </div>
  )
}

export function Login() {
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const { perfil } = useAuth()
  const { state } = useLocation()
  const navigate = useNavigate()
  const destino = typeof state?.desde === 'string' && /^\/(?!\/)/.test(state.desde) ? state.desde : '/inicio'

  async function entrar(evento) {
    evento.preventDefault()
    const campos = new FormData(evento.currentTarget)
    setOcupado(true)
    setError('')
    try {
      await api.iniciar(campos.get('correo').trim().toLowerCase(), campos.get('contrasena'))
      navigate(destino, { replace: true })
    } catch {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setOcupado(false)
    }
  }

  if (perfil) return <Navigate to={destino} replace />

  return (
    <>
      <h1>Iniciar sesión</h1>
      <form className="tarjeta formulario formulario--angosto" onSubmit={entrar}>
        <Campo nombre="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" />
        <Campo nombre="contrasena" etiqueta="Contraseña" type="password" autoComplete="current-password" />
        {error && <p className="mensaje-error" role="alert">{error}</p>}
        <div className="grupo-acciones">
          <button className="boton boton--primario" disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
          <Link to="/recuperar">Olvidé mi contraseña</Link>
        </div>
      </form>
      <p>¿Aún no tienes cuenta? <Link to="/registro">Regístrate como candidato</Link> o <Link to="/registro/empresa">registra tu empresa</Link>.</p>
      {modoDemo && (
        <details className="tarjeta tarjeta--aviso">
          <summary>Cuentas de demostración</summary>
          <ul>
            {cuentasDemo.map(cuenta => <li key={cuenta.id}>{cuenta.perfil.nombre} · {cuenta.correo}</li>)}
          </ul>
          <p>Contraseña de demostración para todas las cuentas: <code>{contrasenaDemo}</code>.</p>
        </details>
      )}
    </>
  )
}

export function Registro({ rol }) {
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const esEmpresa = rol === 'empresa'

  async function registrar(evento) {
    evento.preventDefault()
    const campos = new FormData(evento.currentTarget)
    const leer = nombre => String(campos.get(nombre) ?? '').trim()
    const nombre = leer('nombre')
    const telefono = leer('telefono')
    const datosRol = esEmpresa
      ? { giro: leer('giro') }
      : { edad: Number(leer('edad')), colonia: leer('colonia'), experiencia: leer('experiencia') }

    if (!nombre || !telefono || (esEmpresa ? !datosRol.giro : !datosRol.colonia || !datosRol.experiencia)) {
      setError('Completa todos los campos.')
      return
    }

    setOcupado(true)
    setError('')
    try {
      const { requiereConfirmacion } = await api.registrar(leer('correo').toLowerCase(), campos.get('contrasena'), {
        rol, nombre, telefono, ...datosRol,
      })
      if (requiereConfirmacion) {
        setMensaje('Revisa tu correo para confirmar tu cuenta.')
      } else {
        setMensaje(esEmpresa
          ? 'Tu cuenta de empresa ya está lista.'
          : 'Tu cuenta ya está creada. AMAC revisará tu perfil antes de que puedas postularte.')
      }
    } catch {
      setError('No se pudo crear la cuenta. Revisa los datos o inicia sesión si ya tienes una cuenta.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h1>{esEmpresa ? 'Registrar empresa' : 'Crear cuenta de candidato'}</h1>
      {mensaje ? (
        <section className="tarjeta tarjeta--aviso">
          <p role="status">{mensaje}</p>
          <Link className="boton boton--primario" to={esEmpresa ? '/empresa/vacantes' : '/'}>Continuar</Link>
        </section>
      ) : (
        <>
          <p>Todos los campos son obligatorios.</p>
          <form className="tarjeta formulario" onSubmit={registrar}>
            <fieldset className="grupo-campos">
              <legend>{esEmpresa ? 'Datos de la empresa' : 'Datos personales'}</legend>
              <div className="fila-campos">
                <Campo nombre="nombre" etiqueta={esEmpresa ? 'Nombre de la empresa' : 'Nombre completo'} autoComplete={esEmpresa ? 'organization' : 'name'} />
                <Campo nombre="telefono" etiqueta="Teléfono" type="tel" autoComplete="tel" />
              </div>
              {esEmpresa ? <Campo nombre="giro" etiqueta="Giro" /> : (
                <>
                  <div className="fila-campos">
                    <Campo nombre="edad" etiqueta="Edad" type="number" min="18" max="120" />
                    <Campo nombre="colonia" etiqueta="Colonia" />
                  </div>
                  <div className="campo-formulario">
                    <label htmlFor="experiencia">Experiencia</label>
                    <textarea id="experiencia" name="experiencia" rows="3" required />
                  </div>
                </>
              )}
            </fieldset>
            <fieldset className="grupo-campos">
              <legend>Datos de acceso</legend>
              <div className="fila-campos">
                <Campo nombre="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" />
                <Campo nombre="contrasena" etiqueta="Contraseña (al menos 6 caracteres)" type="password" minLength={6} autoComplete="new-password" />
              </div>
              {modoDemo && <p>Usa datos ficticios. Para volver a entrar, la clave de demostración es <code>{contrasenaDemo}</code>.</p>}
            </fieldset>
            {!esEmpresa && (
              <>
                <details>
                  <summary>Términos de uso</summary>
                  <p>AMAC usará tu perfil para tramitar tus postulaciones. Las empresas podrán consultar los datos de tu perfil cuando te postules a sus vacantes.</p>
                </details>
                <label className="casilla"><input type="checkbox" name="terminos" required /> Acepto los términos de uso.</label>
              </>
            )}
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <div className="grupo-acciones">
              <button className="boton boton--primario" disabled={ocupado}>{ocupado ? 'Creando cuenta…' : 'Crear cuenta'}</button>
              <Link className="boton boton--secundario" to="/login">Ya tengo cuenta</Link>
            </div>
          </form>
          <p><Link to={esEmpresa ? '/registro' : '/registro/empresa'}>{esEmpresa ? 'Registrarme como candidato' : 'Registrar una empresa'}</Link></p>
        </>
      )}
    </>
  )
}

export function Recuperar() {
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function solicitar(evento) {
    evento.preventDefault()
    setError('')
    if (modoDemo) {
      setMensaje('La demostración no envía correos. Puedes volver a entrar con la clave de demostración.')
      return
    }

    const correo = new FormData(evento.currentTarget).get('correo').trim().toLowerCase()
    setOcupado(true)
    try {
      await api.recuperar(correo)
      setMensaje('Si hay una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.')
    } catch {
      setError('No se pudo enviar la solicitud. Intenta de nuevo en unos minutos.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h1>Recuperar contraseña</h1>
      <form className="tarjeta formulario formulario--angosto" onSubmit={solicitar}>
        <Campo nombre="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" />
        {mensaje && <p role="status">{mensaje}</p>}
        {error && <p className="mensaje-error" role="alert">{error}</p>}
        <button className="boton boton--primario" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar enlace'}</button>
        <Link to="/login">Volver a iniciar sesión</Link>
      </form>
    </>
  )
}

export function Restablecer() {
  const { usuario, cargando } = useAuth()
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const navigate = useNavigate()

  async function cambiar(evento) {
    evento.preventDefault()
    const campos = new FormData(evento.currentTarget)
    if (campos.get('contrasena') !== campos.get('confirmar')) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setOcupado(true)
    setError('')
    try {
      await api.cambiarContrasena(campos.get('contrasena'))
      navigate('/inicio', { replace: true, state: { aviso: 'Cambiaste tu contraseña.' } })
    } catch {
      setError('No se pudo cambiar la contraseña. Solicita un enlace nuevo o vuelve a intentarlo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <h1>Cambiar contraseña</h1>
      {cargando ? <p role="status">Verificando enlace…</p> : modoDemo || !usuario ? (
        <p>Solicita un <Link to="/recuperar">nuevo enlace de recuperación</Link>.</p>
      ) : (
        <form className="tarjeta formulario formulario--angosto" onSubmit={cambiar}>
          <Campo nombre="contrasena" etiqueta="Contraseña nueva (al menos 6 caracteres)" type="password" minLength={6} autoComplete="new-password" />
          <Campo nombre="confirmar" etiqueta="Confirma la contraseña" type="password" minLength={6} autoComplete="new-password" />
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton boton--primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      )}
    </>
  )
}
