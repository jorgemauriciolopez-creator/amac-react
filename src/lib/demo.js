const claveDatos = 'amac-demo-datos-v1'
const claveSesion = 'amac-demo-sesion-v1'
const eventoSesion = 'amac-demo-sesion'
export const contrasenaDemo = 'AmacDemo2026'
export const cuentasDemo = [
  { id: 'candidato', correo: 'candidato@amac.test', perfil: { rol: 'candidato', nombre: 'Carlos Martínez', edad: 66, colonia: 'Centro', experiencia: 'Atención al cliente', aprobado: true } },
  { id: 'pendiente', correo: 'pendiente@amac.test', perfil: { rol: 'candidato', nombre: 'Rosa Pérez', edad: 61, colonia: 'San Nicolás', experiencia: 'Auxiliar administrativa', aprobado: false } },
  { id: 'empresa', correo: 'empresa@amac.test', perfil: { rol: 'empresa', nombre: 'Comercio Ejemplo', giro: 'Servicios' } },
  { id: 'admin', correo: 'admin@amac.test', perfil: { rol: 'admin', nombre: 'Administración AMAC' } },
]

function datosIniciales() {
  const ejemplos = [
    ['Auxiliar de atención', 6400, 'Monterrey Centro', 'Medio tiempo', 'Atención al cliente'],
    ['Capturista de datos', 7200, 'San Nicolás', 'Matutino', 'Administración'],
    ['Asistente de archivo', 6800, 'Guadalupe', 'Vespertino', 'Administración'],
    ['Anfitrión de tienda', 4500, 'San Pedro', 'Fines de semana', 'Atención al cliente', '8100000000'],
    ['Recepcionista', 8600, 'Monterrey', 'Matutino', 'Atención al cliente'],
    ['Asesor de piso', 7300, 'Apodaca', 'Medio tiempo', 'Atención al cliente'],
  ]

  return {
    cuentas: cuentasDemo.map(({ id, correo, perfil }) => ({
      id, correo, perfil: { id, telefono: '8100000000', aprobado: false, ...perfil },
    })),
    vacantes: ejemplos.map(([titulo, sueldo, ubicacion, horario, categoria, telefono_contacto], i) => ({
      id: i + 1, empresa_id: 'empresa', titulo, sueldo, ubicacion, horario, categoria,
      telefono_contacto: telefono_contacto || null, estado: 'activa',
      creada_en: new Date().toISOString(),
      descripcion: 'Apoya al equipo en las actividades diarias del puesto.',
      requisitos: 'Disponibilidad en el horario indicado y trato amable.',
      prestaciones: 'Capacitación y prestaciones de ley.',
    })),
    solicitudes: [],
    favoritas: [],
  }
}

function leerDatos() {
  const guardado = localStorage.getItem(claveDatos)
  return guardado ? JSON.parse(guardado) : datosIniciales()
}

function guardarDatos(datos) {
  localStorage.setItem(claveDatos, JSON.stringify(datos))
}

function usuarioActual() {
  const id = sessionStorage.getItem(claveSesion)
  const cuenta = leerDatos().cuentas.find(cuenta => cuenta.id === id)
  return cuenta ? { id, email: cuenta.correo } : null
}

function cuentaActual(datos, rol) {
  const id = sessionStorage.getItem(claveSesion)
  const cuenta = datos.cuentas.find(cuenta => cuenta.id === id)
  if (!cuenta || (rol && cuenta.perfil.rol !== rol)) throw new Error('No tienes acceso a esta acción.')
  return cuenta
}

function sesion(id) {
  if (id) sessionStorage.setItem(claveSesion, id)
  else sessionStorage.removeItem(claveSesion)
  window.dispatchEvent(new Event(eventoSesion))
}

function vacantePublica(datos, vacante) {
  if (!vacante) return null
  const { nombre, logo_url } = datos.cuentas.find(cuenta => cuenta.id === vacante.empresa_id).perfil
  return { ...vacante, empresa: { nombre, logo_url } }
}

function vacantePropia(datos, id) {
  const cuenta = cuentaActual(datos, 'empresa')
  const vacante = datos.vacantes.find(vacante => vacante.id === Number(id) && vacante.empresa_id === cuenta.id)
  if (!vacante) throw new Error('No se encontró la vacante.')
  return vacante
}

function vacanteVisible(datos, vacante, id) {
  return vacante && (vacante.estado === 'activa' || vacante.empresa_id === id ||
    datos.solicitudes.some(s => s.vacante_id === vacante.id && s.candidato_id === id))
}

function siguienteId(filas) {
  return Math.max(0, ...filas.map(fila => fila.id)) + 1
}

function cambiarEstatus(solicitud, estatus) {
  if (solicitud.estatus !== estatus) {
    solicitud.estatus = estatus
    solicitud.estatus_actualizado_en = new Date().toISOString()
  }
}

export function crearApiDemo() {
  return {
    escucharSesion(recibir) {
      function informar() {
        recibir(usuarioActual())
      }

      window.addEventListener(eventoSesion, informar)
      informar()
      return () => window.removeEventListener(eventoSesion, informar)
    },

    async obtenerPerfil(id) {
      const cuenta = cuentaActual(leerDatos())
      if (cuenta.id !== id) throw new Error('No se encontró el perfil de esta cuenta.')
      return cuenta.perfil
    },

    async iniciar(correo, contrasena) {
      const cuenta = leerDatos().cuentas.find(cuenta => cuenta.correo === correo)
      if (!cuenta || contrasena !== contrasenaDemo) throw new Error('Correo o contraseña incorrectos.')
      sesion(cuenta.id)
      return usuarioActual()
    },

    async cerrarSesion() {
      sesion(null)
    },

    async registrar(correo, _contrasena, perfil) {
      const datos = leerDatos()
      if (datos.cuentas.some(cuenta => cuenta.correo === correo)) throw new Error('Ya existe una cuenta de demostración con ese correo.')
      if (!['candidato', 'empresa'].includes(perfil.rol)) throw new Error('Elige un tipo de cuenta válido.')
      const id = crypto.randomUUID()
      datos.cuentas.push({ id, correo, perfil: { ...perfil, id, aprobado: false } })
      guardarDatos(datos)
      sesion(id)
      return { requiereConfirmacion: false }
    },

    async listarVacantes() {
      const datos = leerDatos()
      return datos.vacantes.filter(vacante => vacante.estado === 'activa')
        .map(vacante => vacantePublica(datos, vacante))
    },

    async obtenerVacante(id) {
      const datos = leerDatos()
      const usuario = usuarioActual()
      const vacante = datos.vacantes.find(vacante => vacante.id === Number(id))
      return vacanteVisible(datos, vacante, usuario?.id) ? vacantePublica(datos, vacante) : null
    },

    async postular(id) {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'candidato')
      if (!cuenta.perfil.aprobado) throw new Error('Tu cuenta está pendiente de aprobación.')
      const vacante = datos.vacantes.find(vacante => vacante.id === Number(id) && vacante.estado === 'activa')
      if (!vacante) throw new Error('La vacante ya no está activa.')
      if (datos.solicitudes.some(s => s.vacante_id === vacante.id && s.candidato_id === cuenta.id)) {
        throw Object.assign(new Error('Ya te postulaste a esta vacante.'), { code: '23505' })
      }
      const ahora = new Date().toISOString()
      datos.solicitudes.push({
        id: siguienteId(datos.solicitudes), vacante_id: vacante.id, candidato_id: cuenta.id,
        estatus: 'Enviada', etapa: 'Postulación', creada_en: ahora, estatus_actualizado_en: null,
      })
      guardarDatos(datos)
    },

    async listarMisSolicitudes() {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'candidato')
      return datos.solicitudes.filter(s => s.candidato_id === cuenta.id).reverse().map(s => ({
        ...s, vacante: vacantePublica(datos, datos.vacantes.find(v => v.id === s.vacante_id)),
      }))
    },

    async cancelarSolicitud(id) {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'candidato')
      const solicitud = datos.solicitudes.find(s => s.id === Number(id) && s.candidato_id === cuenta.id)
      if (!solicitud || !['Enviada', 'En revisión'].includes(solicitud.estatus)) {
        throw new Error('Esta solicitud ya no se puede cancelar.')
      }
      cambiarEstatus(solicitud, 'Cancelada')
      guardarDatos(datos)
      return { estatus_actualizado_en: solicitud.estatus_actualizado_en }
    },

    async listarFavoritas() {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'candidato')
      return datos.favoritas.filter(f => f.candidato_id === cuenta.id).reverse()
        .map(f => datos.vacantes.find(v => v.id === f.vacante_id))
        .filter(vacante => vacanteVisible(datos, vacante, cuenta.id))
        .map(vacante => vacantePublica(datos, vacante))
    },

    async cambiarFavorita(id, guardar) {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'candidato')
      const vacante_id = Number(id)
      const coincide = f => f.vacante_id === vacante_id && f.candidato_id === cuenta.id
      if (guardar) {
        if (!datos.vacantes.some(v => v.id === vacante_id && v.estado === 'activa')) {
          throw new Error('La vacante ya no está activa.')
        }
        if (!datos.favoritas.some(coincide)) datos.favoritas.push({ candidato_id: cuenta.id, vacante_id })
      } else {
        datos.favoritas = datos.favoritas.filter(f => !coincide(f))
      }
      guardarDatos(datos)
    },

    async actualizarPerfil(perfil) {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos)
      const campos = cuenta.perfil.rol === 'empresa' ? ['nombre', 'giro', 'telefono', 'logo_url'] :
        ['nombre', 'telefono', 'edad', 'colonia', 'experiencia']
      for (const campo of campos) {
        if (Object.hasOwn(perfil, campo)) cuenta.perfil[campo] = perfil[campo]
      }
      guardarDatos(datos)
      return cuenta.perfil
    },

    async listarVacantesEmpresa() {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'empresa')
      return datos.vacantes.filter(v => v.empresa_id === cuenta.id).reverse().map(v => ({
        ...v, total_solicitudes: datos.solicitudes.filter(s => s.vacante_id === v.id).length,
      }))
    },

    async guardarVacante(vacante, id) {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'empresa')
      if (id == null) {
        id = siguienteId(datos.vacantes)
        datos.vacantes.push({
          ...vacante, id, empresa_id: cuenta.id, estado: 'activa', creada_en: new Date().toISOString(),
        })
      } else {
        Object.assign(vacantePropia(datos, id), vacante)
      }
      guardarDatos(datos)
      return { id }
    },

    async cambiarEstadoVacante(id, estado) {
      const datos = leerDatos()
      const vacante = vacantePropia(datos, id)
      if (vacante.estado === 'cerrada' || !['activa', 'pausada', 'cerrada'].includes(estado)) {
        throw new Error('No se puede hacer ese cambio de estado.')
      }
      vacante.estado = estado
      guardarDatos(datos)
    },

    async listarSolicitudesRecibidas() {
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'empresa')
      return datos.solicitudes.filter(s => s.estatus !== 'Cancelada').reverse().flatMap(s => {
        const vacante = datos.vacantes.find(v => v.id === s.vacante_id && v.empresa_id === cuenta.id)
        if (!vacante) return []
        const candidato = datos.cuentas.find(c => c.id === s.candidato_id).perfil
        return [{ ...s, vacante, candidato }]
      })
    },

    async actualizarSolicitud(id, { estatus, etapa }) {
      const datos = leerDatos()
      const solicitud = datos.solicitudes.find(s => s.id === Number(id) && s.estatus !== 'Cancelada')
      if (!solicitud) throw new Error('La solicitud ya no está disponible.')
      vacantePropia(datos, solicitud.vacante_id)
      if (!['En revisión', 'Aceptada', 'Rechazada'].includes(estatus) && solicitud.estatus !== estatus) {
        throw new Error('Elige un estatus válido.')
      }
      if (!['Postulación', 'Revisión', 'Entrevista', 'Decisión'].includes(etapa)) throw new Error('Elige una etapa válida.')
      cambiarEstatus(solicitud, estatus)
      solicitud.etapa = etapa
      guardarDatos(datos)
    },

    async subirLogo(archivo) {
      const { id } = cuentaActual(leerDatos(), 'empresa')
      const url = await new Promise((resolve, reject) => {
        const lector = new FileReader()
        lector.onload = () => resolve(lector.result)
        lector.onerror = () => reject(new Error('No se pudo leer el logo.'))
        lector.readAsDataURL(archivo)
      })
      const datos = leerDatos()
      const cuenta = cuentaActual(datos, 'empresa')
      if (cuenta.id !== id) throw new Error('La sesión cambió. Vuelve a intentar.')
      cuenta.perfil.logo_url = url
      guardarDatos(datos)
      return url
    },

    async listarCandidatosPendientes() {
      const datos = leerDatos()
      cuentaActual(datos, 'admin')
      return datos.cuentas.filter(c => c.perfil.rol === 'candidato' && !c.perfil.aprobado)
        .map(c => c.perfil)
    },

    async aprobarCandidato(id) {
      const datos = leerDatos()
      cuentaActual(datos, 'admin')
      const cuenta = datos.cuentas.find(c => c.id === id && c.perfil.rol === 'candidato')
      if (!cuenta) throw new Error('No se encontró el candidato.')
      cuenta.perfil.aprobado = true
      guardarDatos(datos)
    },
  }
}
