import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined)
  const [registro, setRegistro] = useState(null)
  const [version, setVersion] = useState(0)
  const id = usuario?.id

  useEffect(() => api.escucharSesion(nuevoUsuario => {
    setUsuario(nuevoUsuario)
    if (!nuevoUsuario) setRegistro(null)
  }), [])

  useEffect(() => {
    if (!id) return
    let vigente = true

    api.obtenerPerfil(id).then(
      perfil => { if (vigente) setRegistro({ id, perfil, errorPerfil: '' }) },
      () => { if (vigente) setRegistro({ id, perfil: null, errorPerfil: 'No pudimos cargar tu perfil.' }) },
    )

    return () => { vigente = false }
  }, [id, version])

  const perfilActual = id && registro?.id === id ? registro : null

  async function recargarPerfil() {
    if (!id) return null
    const perfil = await api.obtenerPerfil(id)
    setRegistro(actual => actual?.id === id ? { id, perfil, errorPerfil: '' } : actual)
    return perfil
  }

  return (
    <AuthContext.Provider value={{
      usuario,
      perfil: perfilActual?.perfil ?? null,
      cargando: usuario === undefined || Boolean(id && !perfilActual),
      errorPerfil: perfilActual?.errorPerfil ?? '',
      recargarPerfil,
      reintentarPerfil: () => setVersion(actual => actual + 1),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
