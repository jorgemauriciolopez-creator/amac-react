import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { api, modoDemo } from './lib/api'
import { Login, Recuperar, Registro, Restablecer } from './pages/Acceso'
import { DetalleVacante, Favoritas, ListadoVacantes, MisSolicitudes, PerfilCandidato } from './pages/Candidato'
import { Administracion, EmpresaVacantes, FormularioVacante, PerfilEmpresa, SolicitudesRecibidas } from './pages/Empresa'

const inicioPorRol = { candidato: '/mis-solicitudes', empresa: '/empresa/vacantes', admin: '/admin' }

function EnlaceNav({ to, children, primario = false, soloEscritorio = false }) {
  const tipo = primario ? 'boton--primario' : 'boton--secundario'
  return (
    <NavLink end to={to} className={'boton ' + tipo + (soloEscritorio ? ' solo-escritorio' : '')}>
      {children}
    </NavLink>
  )
}

function Encabezado() {
  const { perfil, usuario, cargando } = useAuth()
  const [cerrando, setCerrando] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function salir() {
    setError('')
    setCerrando(true)
    try {
      await api.cerrarSesion()
      navigate('/', { replace: true })
    } catch {
      setError('No pudimos cerrar la sesión. Intenta de nuevo.')
    } finally {
      setCerrando(false)
    }
  }

  return (
    <>
      <a className="saltar-contenido" href="#principal">Saltar al contenido</a>
      <header className="encabezado">
        <div className="contenedor">
          <Link className="logo" to="/">
            <img src="/img/logo-amac.png" alt="AMAC, asociAMayores A.C. Ir al inicio" width="220" height="74" />
          </Link>
          {!usuario && !cargando && <Link className="boton boton--secundario encabezado__cuenta solo-movil" to="/login">Entrar</Link>}
          <nav className={'navegacion' + (usuario ? ' navegacion--sesion' : '')} aria-label="Navegación principal">
            <EnlaceNav to="/">Vacantes</EnlaceNav>
            {!usuario && !cargando && (
              <>
                <EnlaceNav to="/mis-solicitudes">Mis solicitudes</EnlaceNav>
                <EnlaceNav to="/login" soloEscritorio>Iniciar sesión</EnlaceNav>
                <EnlaceNav to="/registro" primario soloEscritorio>Registrarme</EnlaceNav>
              </>
            )}
            {perfil?.rol === 'candidato' && (
              <>
                <EnlaceNav to="/mis-solicitudes">Mis solicitudes</EnlaceNav>
                <EnlaceNav to="/favoritas">Favoritas</EnlaceNav>
                <EnlaceNav to="/perfil">Mi perfil</EnlaceNav>
              </>
            )}
            {perfil?.rol === 'empresa' && (
              <>
                <EnlaceNav to="/empresa/vacantes">Mis vacantes</EnlaceNav>
                <EnlaceNav to="/empresa/solicitudes">Solicitudes</EnlaceNav>
                <EnlaceNav to="/empresa/perfil">Perfil de empresa</EnlaceNav>
              </>
            )}
            {perfil?.rol === 'admin' && <EnlaceNav to="/admin">Administración</EnlaceNav>}
            {usuario && (
              <button type="button" className="boton boton--secundario" onClick={salir} disabled={cerrando}>
                {cerrando ? 'Saliendo…' : 'Salir'}
              </button>
            )}
          </nav>
          {error && <p role="alert">{error}</p>}
        </div>
      </header>
      <a className="ayuda" href="tel:81123456">
        <p className="contenedor">
          <span className="solo-escritorio">¿Necesitas ayuda? Llama a AMAC: 81 123 456</span>
          <span className="solo-movil">Ayuda AMAC · Llamar al 81 123 456</span>
        </p>
      </a>
    </>
  )
}

function Pie() {
  const { usuario } = useAuth()

  return (
    <footer className="pie">
      <div className="contenedor">
        <p className="pie__lema">Envejecer es vivir.</p>
        <p>AMAC · Bolsa de trabajo</p>
        {modoDemo && <p>Demostración local con datos ficticios.</p>}
        {!usuario && <Link className="boton boton--secundario boton--mediano" to="/registro/empresa">Registro de empresa</Link>}
      </div>
    </footer>
  )
}

function ErrorPerfil() {
  const { errorPerfil, reintentarPerfil } = useAuth()
  return (
    <>
      <h1>Mi cuenta</h1>
      <p role="alert">{errorPerfil}</p>
      <button type="button" className="boton boton--secundario boton--corto" onClick={reintentarPerfil}>Volver a intentar</button>
    </>
  )
}

function RutaProtegida({ rol }) {
  const { usuario, perfil, cargando, errorPerfil } = useAuth()
  const { pathname, search } = useLocation()

  if (cargando) return <p role="status">Cargando tu cuenta…</p>
  if (!usuario) return <Navigate to="/login" replace state={{ desde: pathname + search }} />
  if (errorPerfil) return <ErrorPerfil />
  if (perfil?.rol !== rol) return <Navigate to={inicioPorRol[perfil?.rol] || '/'} replace />
  return <Outlet />
}

function InicioCuenta() {
  const { usuario, perfil, cargando, errorPerfil } = useAuth()
  const { state } = useLocation()

  if (cargando) return <p role="status">Cargando tu cuenta…</p>
  if (!usuario) return <Navigate to="/login" replace />
  if (errorPerfil) return <ErrorPerfil />
  return <Navigate to={inicioPorRol[perfil?.rol] || '/'} replace state={state} />
}

function NoEncontrado() {
  return (
    <>
      <h1>Página no encontrada</h1>
      <p>La dirección que buscas no está disponible.</p>
      <Link className="boton boton--primario boton--corto" to="/">Volver a vacantes</Link>
    </>
  )
}

function Sitio() {
  const { pathname, state } = useLocation()
  const principal = useRef(null)
  const rutaAnterior = useRef(pathname)

  useEffect(() => {
    if (rutaAnterior.current === pathname) return
    rutaAnterior.current = pathname
    principal.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <Encabezado />
      <main id="principal" ref={principal} tabIndex="-1" className="contenedor contenido">
        {state?.aviso && <p className="tarjeta tarjeta--aviso" role="status">{state.aviso}</p>}
        <Routes>
          <Route path="/" element={<ListadoVacantes />} />
          <Route path="/vacantes/:id" element={<DetalleVacante />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro key="candidato" rol="candidato" />} />
          <Route path="/registro/empresa" element={<Registro key="empresa" rol="empresa" />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/restablecer" element={<Restablecer />} />
          <Route path="/inicio" element={<InicioCuenta />} />
          <Route element={<RutaProtegida rol="candidato" />}>
            <Route path="/mis-solicitudes" element={<MisSolicitudes />} />
            <Route path="/favoritas" element={<Favoritas />} />
            <Route path="/perfil" element={<PerfilCandidato />} />
          </Route>
          <Route element={<RutaProtegida rol="empresa" />}>
            <Route path="/empresa/vacantes" element={<EmpresaVacantes />} />
            <Route path="/empresa/vacantes/nueva" element={<FormularioVacante />} />
            <Route path="/empresa/vacantes/:id/editar" element={<FormularioVacante />} />
            <Route path="/empresa/solicitudes" element={<SolicitudesRecibidas />} />
            <Route path="/empresa/perfil" element={<PerfilEmpresa />} />
          </Route>
          <Route element={<RutaProtegida rol="admin" />}>
            <Route path="/admin" element={<Administracion />} />
          </Route>
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </main>
      <Pie />
    </>
  )
}

export default function App() {
  if (!api) {
    return (
      <main className="contenedor contenido">
        <h1>AMAC · Bolsa de trabajo</h1>
        <p>Configura las variables de conexión a Supabase para abrir la aplicación.</p>
      </main>
    )
  }

  return <AuthProvider><Sitio /></AuthProvider>
}
