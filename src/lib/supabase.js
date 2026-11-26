const columnasVacante = '*, empresa(nombre, logo_url)'

function datos({ data, error }) {
  if (error) throw error
  return data
}

export function crearApiSupabase(cliente) {
  async function usuarioId() {
    const { session } = datos(await cliente.auth.getSession())
    if (!session) throw new Error('Inicia sesión para continuar.')
    return session.user.id
  }

  return {
    escucharSesion(recibir) {
      const { data: { subscription } } = cliente.auth.onAuthStateChange((_, sesion) => {
        recibir(sesion?.user ?? null)
      })
      return () => subscription.unsubscribe()
    },

    async obtenerPerfil(id) {
      return datos(await cliente.from('perfiles').select('*').eq('id', id).single())
    },

    async iniciar(correo, contrasena) {
      return datos(await cliente.auth.signInWithPassword({ email: correo, password: contrasena })).user
    },

    async cerrarSesion() {
      datos(await cliente.auth.signOut())
    },

    async registrar(correo, contrasena, perfil) {
      const { session } = datos(await cliente.auth.signUp({
        email: correo,
        password: contrasena,
        options: { data: perfil },
      }))
      return { requiereConfirmacion: !session }
    },

    async recuperar(correo) {
      const redirectTo = new URL('/restablecer', window.location.origin).href
      datos(await cliente.auth.resetPasswordForEmail(correo, { redirectTo }))
    },

    async cambiarContrasena(contrasena) {
      datos(await cliente.auth.updateUser({ password: contrasena }))
    },

    async listarVacantes() {
      const lista = []
      const limite = 100
      for (let desde = 0; ; desde += limite) {
        const pagina = datos(await cliente.from('vacantes').select(columnasVacante)
          .eq('estado', 'activa').order('creada_en', { ascending: false })
          .order('id', { ascending: false }).range(desde, desde + limite - 1))
        lista.push(...pagina)
        if (pagina.length < limite) return lista
      }
    },

    async obtenerVacante(id) {
      if (!/^[1-9][0-9]*$/.test(String(id))) return null
      return datos(await cliente.from('vacantes').select(columnasVacante).eq('id', id).maybeSingle())
    },

    async postular(id) {
      const candidato_id = await usuarioId()
      datos(await cliente.from('solicitudes').insert({ vacante_id: id, candidato_id }))
    },

    async listarMisSolicitudes() {
      const id = await usuarioId()
      return datos(await cliente.from('solicitudes')
        .select('id, creada_en, estatus, etapa, estatus_actualizado_en, vacante:vacantes(id, titulo, empresa(nombre))')
        .eq('candidato_id', id).order('creada_en', { ascending: false }))
    },

    async cancelarSolicitud(id) {
      const candidato = await usuarioId()
      return datos(await cliente.from('solicitudes').update({ estatus: 'Cancelada' })
        .eq('id', id).eq('candidato_id', candidato).in('estatus', ['Enviada', 'En revisión'])
        .select('id, estatus_actualizado_en').single())
    },

    async listarFavoritas() {
      const id = await usuarioId()
      const filas = datos(await cliente.from('favoritas').select('vacante:vacantes(' + columnasVacante + ')')
        .eq('candidato_id', id).order('creada_en', { ascending: false }))
      return filas.map(fila => fila.vacante).filter(Boolean)
    },

    async cambiarFavorita(vacanteId, guardar) {
      const candidato_id = await usuarioId()
      if (guardar) {
        const resultado = await cliente.from('favoritas').insert({ candidato_id, vacante_id: vacanteId })
        if (resultado.error?.code !== '23505') datos(resultado)
      } else {
        datos(await cliente.from('favoritas').delete().eq('candidato_id', candidato_id).eq('vacante_id', vacanteId))
      }
    },

    async actualizarPerfil(perfil) {
      const id = await usuarioId()
      return datos(await cliente.from('perfiles').update(perfil).eq('id', id).select().single())
    },

    async listarVacantesEmpresa() {
      const id = await usuarioId()
      const lista = datos(await cliente.from('vacantes').select('*, solicitudes(count)')
        .eq('empresa_id', id).order('creada_en', { ascending: false }))
      return lista.map(({ solicitudes, ...vacante }) => ({
        ...vacante, total_solicitudes: solicitudes[0]?.count ?? 0,
      }))
    },

    async guardarVacante(vacante, id) {
      const empresa_id = await usuarioId()
      const tabla = cliente.from('vacantes')
      const consulta = id == null
        ? tabla.insert({ ...vacante, empresa_id })
        : tabla.update(vacante).eq('id', id).eq('empresa_id', empresa_id)
      return datos(await consulta.select('id').single())
    },

    async cambiarEstadoVacante(id, estado) {
      const empresa = await usuarioId()
      datos(await cliente.from('vacantes').update({ estado })
        .eq('id', id).eq('empresa_id', empresa).select('id').single())
    },

    async listarSolicitudesRecibidas() {
      const id = await usuarioId()
      return datos(await cliente.from('solicitudes').select(
        'id, estatus, etapa, creada_en, estatus_actualizado_en, ' +
        'vacante:vacantes!inner(id, titulo, empresa_id), ' +
        'candidato:perfiles!solicitudes_candidato_id_fkey(id, nombre, edad, colonia, experiencia)',
      ).eq('vacante.empresa_id', id).neq('estatus', 'Cancelada').order('creada_en', { ascending: false }))
    },

    async actualizarSolicitud(id, cambios) {
      datos(await cliente.from('solicitudes').update(cambios).eq('id', id)
        .neq('estatus', 'Cancelada').select('id').single())
    },

    async subirLogo(archivo) {
      const id = await usuarioId()
      const bucket = cliente.storage.from('logos-empresa')
      const ruta = id + '/logo'
      datos(await bucket.upload(ruta, archivo, { upsert: true, contentType: archivo.type, cacheControl: '60' }))
      const { data } = bucket.getPublicUrl(ruta)
      const logo_url = data.publicUrl + '?v=' + Date.now()
      datos(await cliente.from('perfiles').update({ logo_url }).eq('id', id).select('id').single())
      return logo_url
    },

    async listarCandidatosPendientes() {
      return datos(await cliente.rpc('listar_candidatos_pendientes'))
    },

    async aprobarCandidato(id) {
      datos(await cliente.rpc('aprobar_candidato', { candidato: id }))
    },
  }
}
