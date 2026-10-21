import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileFor, setProfileFor] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setInitialized(true)
    })
    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock the client.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  const reloadProfile = useCallback(async () => {
    if (!userId) return null
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
    setProfileFor(userId)
    return data
  }, [userId])

  useEffect(() => {
    if (userId) reloadProfile()
    else {
      setProfile(null)
      setProfileFor(null)
    }
  }, [userId, reloadProfile])

  // Loading until the initial session is known and the profile matches the signed-in user.
  const loading = !initialized || (Boolean(userId) && profileFor !== userId)

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user, profile: profileFor === userId ? profile : null, loading, signOut, reloadProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
