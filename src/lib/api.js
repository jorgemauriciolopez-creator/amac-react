import { createClient } from '@supabase/supabase-js'
import { crearApiDemo } from './demo'
import { crearApiSupabase } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const llave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const modoDemo = import.meta.env.DEV && !url && !llave
export const api = modoDemo
  ? crearApiDemo()
  : url && llave
    ? crearApiSupabase(createClient(url, llave))
    : null
