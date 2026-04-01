import { useEffect, useReducer, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Landing from './screens/Landing'
import HeroLanding from './screens/HeroLanding'
import Connecting from './screens/Connecting'
import Chat from './screens/Chat'
import Disconnect from './screens/Disconnect'
import MidnightMode from './screens/MidnightMode'
import Login from './screens/Login'
import Register from './screens/Register'
import ChooseUsername from './screens/ChooseUsername'
import { useLowSignal } from './hooks/useLowSignal'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { identifyUser, trackEvent } from './lib/analytics'
import { appFlowReducer, buildDisconnectSummary, initialAppFlow } from './lib/appFlow'
import { DEFAULT_SIGNAL_MODE, getSignalAvailability, normalizeSignalMode } from './lib/signalModes'
import { auth, provider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from './lib/firebase'
import { findMatch, cancelMatch, listenForRoomInvite, endRoom, getUsername, saveUsername, isUsernameTaken, getActiveRoom } from './lib/chat'
import { appendSessionHistory, readSessionHistory } from './lib/sessionHistory'
import { setAudioEnabled, resumeAudio } from './lib/audioEngine'
import { ensureNotificationPermission, notifyMatchFound, registerPushForUser } from './lib/notifications'

function getTimeOfDayLabel(timestampMs) {
  const hour = new Date(timestampMs).getHours()
  if (hour < 5) return 'deep night'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'late night'
}

function App() {
  const [flow, dispatch] = useReducer(appFlowReducer, initialAppFlow)
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isTriggered, setIsTriggered] = useState(false)
  const [availableSignalMode, setAvailableSignalMode] = useState(null)
  const [signalAvailability, setSignalAvailability] = useState(() => getSignalAvailability({ battery: null, manualMode: false }))
  const [devBypass, setDevBypass] = useState(false)
  const [audioEnabled, setAudioPreference] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('last-signal.audio-enabled') === 'true'
  })
  const [sessionHistory, setSessionHistory] = useState(() => {
    if (typeof window === 'undefined') return []
    return readSessionHistory()
  })
  const { isLowSignal, manualMode, setManualMode, battery } = useLowSignal()
  const { canInstall, isIOS, install } = useInstallPrompt()
  const matchUnsubRef = useRef(null)
  const matchRequestRef = useRef(null)
  const enteringMatchRef = useRef(false)
  const endingSessionRef = useRef(false)
  const logoutRef = useRef(false)
  const loginAttemptsRef = useRef({ count: 0, cooldownUntil: 0 })
  const registerAttemptsRef = useRef({ count: 0, cooldownUntil: 0 })
  const lastSearchAgainRef = useRef(0)

  const { screen, roomId, username, activeSignalMode, matchingStartedAt, disconnectSummary } = flow
  const currentSignalMode = normalizeSignalMode(activeSignalMode || availableSignalMode || DEFAULT_SIGNAL_MODE)
  const displayName = username || (user ? user.uid.slice(0, 8) : null)
  const showAtmosphere = screen !== 'chat'
  const atmosphereMode = currentSignalMode === 'battery' ? 'battery' : 'midnight'
  const shouldShowLockScreen = !isTriggered && !devBypass && screen !== 'chat'

  const cleanupMatchListener = () => {
    if (matchUnsubRef.current) {
      matchUnsubRef.current()
      matchUnsubRef.current = null
    }
  }

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] State changed:', firebaseUser?.uid || 'signed out')
      setUser(firebaseUser)

      // Ensure we stop loading eventually even if Firestore hangs
      const loadingTimeout = setTimeout(() => {
        setAuthLoading((current) => {
          if (current) console.warn('[Auth] Initialization taking too long, forcing load clear');
          return false;
        })
      }, 5000)

      try {
        if (!firebaseUser) {
          dispatch({ type: 'AUTH_SIGNED_OUT' })
          return
        }

        let existingName = null
        try {
          existingName = await getUsername(firebaseUser.uid)
        } catch (err) {
          console.error('[Auth] Failed to fetch username:', err)
        }

        if (!existingName) {
          dispatch({ type: 'AUTH_USERNAME_REQUIRED' })
          return
        }

        let activeRoom = null
        try {
          activeRoom = await getActiveRoom(firebaseUser.uid)
        } catch (err) {
          if (err?.code === 'permission-denied') {
            console.warn('[Auth] Active room read denied by Firestore rules. Continuing without active room.')
          } else {
            console.error('[Auth] Failed to fetch active room:', err)
          }
        }

        dispatch({
          type: 'AUTH_READY',
          username: existingName,
          screen: activeRoom ? 'chat' : 'landing',
          roomId: activeRoom?.roomId || null,
          signalMode: activeRoom?.mode || null,
        })
      } catch (err) {
        console.error('[Auth] Unexpected initialization error:', err)
      } finally {
        clearTimeout(loadingTimeout)
        setAuthLoading(false)
        console.log('[Auth] Initialization complete')
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const nextAvailability = getSignalAvailability({ battery, manualMode })
    setSignalAvailability(nextAvailability)
    setAvailableSignalMode(nextAvailability.signalMode)
    setIsTriggered(nextAvailability.isTriggered)
  }, [battery, manualMode])

  useEffect(() => {
    if (!user || !username) return
    identifyUser(user.uid, { signal_name: username })
  }, [user, username])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('last-signal.audio-enabled', audioEnabled ? 'true' : 'false')
    }

    setAudioEnabled(audioEnabled)
  }, [audioEnabled])

  useEffect(() => {
    if (!user?.uid) return
    registerPushForUser(user.uid)
  }, [user?.uid])

  useEffect(() => {
    if (authLoading) return
    trackEvent('screen_view', {
      screen_name: screen,
      signal_mode: currentSignalMode,
      signal_ready: isTriggered || devBypass,
    })
  }, [authLoading, currentSignalMode, devBypass, isTriggered, screen])

  const handleLogin = async (email, password) => {
    const now = Date.now()
    const { count, cooldownUntil } = loginAttemptsRef.current
    if (now < cooldownUntil) {
      const secsLeft = Math.ceil((cooldownUntil - now) / 1000)
      throw new Error(`Too many attempts — try again in ${secsLeft}s`)
    }
    try {
      await signInWithEmailAndPassword(auth, email, password)
      loginAttemptsRef.current = { count: 0, cooldownUntil: 0 }
      await trackEvent('login_attempt', { provider: 'password' })
    } catch (err) {
      const nextCount = count + 1
      loginAttemptsRef.current = {
        count: nextCount,
        cooldownUntil: nextCount >= 5 ? now + 30_000 : 0,
      }
      throw err
    }
  }

  const handleRegister = async (email, password) => {
    const now = Date.now()
    const { count, cooldownUntil } = registerAttemptsRef.current
    if (now < cooldownUntil) {
      const secsLeft = Math.ceil((cooldownUntil - now) / 1000)
      throw new Error(`Too many attempts — try again in ${secsLeft}s`)
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password)
      registerAttemptsRef.current = { count: 0, cooldownUntil: 0 }
      await trackEvent('sign_up', { provider: 'password' })
    } catch (err) {
      const nextCount = count + 1
      registerAttemptsRef.current = {
        count: nextCount,
        cooldownUntil: nextCount >= 3 ? now + 60_000 : 0,
      }
      throw err
    }
  }

  const handleGoogleLogin = async () => {
    await signInWithPopup(auth, provider)
    await trackEvent('login_attempt', { provider: 'google' })
  }

  const handleSaveUsername = async (chosenName) => {
    const taken = await isUsernameTaken(chosenName)
    if (taken) {
      throw new Error('Signal name already claimed — try another')
    }

    await saveUsername(user.uid, chosenName)
    dispatch({ type: 'USERNAME_SAVED', username: chosenName })
    await trackEvent('username_saved', { has_username: true })
  }

  const handleLogout = async () => {
    if (logoutRef.current) return
    logoutRef.current = true

    try {
      cleanupMatchListener()
      if (user) await cancelMatch(user.uid)
      if (roomId) await endRoom(roomId)
      if (auth) await signOut(auth)
      dispatch({ type: 'AUTH_SIGNED_OUT' })
      await trackEvent('logout', { screen_name: screen })
    } finally {
      logoutRef.current = false
    }
  }

  const handleEntering = async () => {
    if (!user || enteringMatchRef.current) return

    resumeAudio()
    ensureNotificationPermission()

    enteringMatchRef.current = true
    const startedAt = Date.now()
    matchRequestRef.current = {
      startedAt,
      matchedInMs: null,
      signalMode: currentSignalMode,
    }

    dispatch({
      type: 'MATCH_START',
      signalMode: currentSignalMode,
      startedAt,
    })

    await trackEvent('match_search_started', {
      signal_mode: currentSignalMode,
      trigger_reason: signalAvailability.reason,
    })

    try {
      const matchedRoomId = await findMatch(user.uid, currentSignalMode)

      if (matchedRoomId) {
        matchRequestRef.current = {
          ...matchRequestRef.current,
          matchedInMs: Date.now() - startedAt,
        }
        dispatch({ type: 'MATCH_FOUND', roomId: matchedRoomId, signalMode: currentSignalMode })
        notifyMatchFound(currentSignalMode)
        await trackEvent('match_found', {
          signal_mode: currentSignalMode,
          matched_in_ms: matchRequestRef.current.matchedInMs,
          match_type: 'instant',
        })
        enteringMatchRef.current = false
        return
      }

      matchUnsubRef.current = listenForRoomInvite(user.uid, async (nextRoomId) => {
        cleanupMatchListener()
        matchRequestRef.current = {
          ...matchRequestRef.current,
          matchedInMs: Date.now() - startedAt,
        }
        dispatch({ type: 'MATCH_FOUND', roomId: nextRoomId, signalMode: currentSignalMode })
        notifyMatchFound(currentSignalMode)
        await trackEvent('match_found', {
          signal_mode: currentSignalMode,
          matched_in_ms: matchRequestRef.current.matchedInMs,
          match_type: 'queued',
        })
        enteringMatchRef.current = false
      })
    } catch (err) {
      console.error('[Match] Error:', err)
      dispatch({ type: 'MATCH_ABORTED' })
      enteringMatchRef.current = false
    }
  }

  const handleAbortMatch = async () => {
    cleanupMatchListener()
    enteringMatchRef.current = false
    if (user) await cancelMatch(user.uid)
    dispatch({ type: 'MATCH_ABORTED' })
    await trackEvent('match_search_aborted', { signal_mode: currentSignalMode })
  }

  const handleSearchAgain = async () => {
    if (!user) return
    if (Date.now() - lastSearchAgainRef.current < 3_000) return
    lastSearchAgainRef.current = Date.now()

    cleanupMatchListener()
    enteringMatchRef.current = false
    await cancelMatch(user.uid)
    await trackEvent('match_search_retry', { signal_mode: currentSignalMode })
    await handleEntering()
  }

  const handleEndSession = async (summaryOverrides = {}) => {
    if (endingSessionRef.current) return
    endingSessionRef.current = true

    try {
      cleanupMatchListener()
      if (roomId && !summaryOverrides.skipRemoteUpdate) {
        await endRoom(roomId)
      }

      const summary = buildDisconnectSummary({
        reason: summaryOverrides.reason || 'ended',
        signalMode: currentSignalMode,
        matchedInMs: summaryOverrides.matchedInMs ?? matchRequestRef.current?.matchedInMs ?? null,
        durationMs: summaryOverrides.durationMs ?? null,
        endedAt: summaryOverrides.endedAt ?? Date.now(),
        timeOfDay: summaryOverrides.timeOfDay ?? getTimeOfDayLabel(summaryOverrides.endedAt ?? Date.now()),
        messagesCount: summaryOverrides.messagesCount ?? null,
        chatTranscript: summaryOverrides.chatTranscript ?? null,
      })

      dispatch({ type: 'SESSION_ENDED', summary })
      await trackEvent('session_ended', {
        signal_mode: summary.signalMode,
        reason: summary.reason,
        matched_in_ms: summary.matchedInMs,
        duration_ms: summary.durationMs,
      })
      setSessionHistory(appendSessionHistory(summary))
      matchRequestRef.current = null
      enteringMatchRef.current = false
    } finally {
      endingSessionRef.current = false
    }
  }

  const handleReturnToWait = async (choice = 'fade') => {
    const nextSummary = disconnectSummary ? { ...disconnectSummary, choice } : null
    dispatch({ type: 'DISCONNECT_RETURNED', summary: nextSummary })
    await trackEvent('disconnect_choice', {
      choice,
      signal_mode: disconnectSummary?.signalMode || currentSignalMode,
      reason: disconnectSummary?.reason || 'ended',
    })
  }

  const toggleManualLowSignal = () => setManualMode(!manualMode)
  const toggleAudio = () => {
    resumeAudio()
    setAudioPreference((value) => !value)
  }

  return (
    <div className="bg-background min-h-screen text-white overflow-hidden selection:bg-blue-500/20 relative isolate">
      {showAtmosphere && (
        <div className={`moonlight-atmosphere moonlight-atmosphere-${atmosphereMode} pointer-events-none absolute inset-0 z-0`} aria-hidden="true">
          <div className="moonlight-haze" />
          <div className="moon-disc" />
          <div className="starfield starfield-near" />
          <div className="starfield starfield-far" />
          <div className="constellation-lines constellation-a" />
          <div className="constellation-lines constellation-b" />
        </div>
      )}

      {authLoading && (
        <div className="min-h-screen flex items-center justify-center relative z-10">
          <p className="text-white/50 text-[10px] tracking-[0.4em] uppercase animate-pulse">
            scanning frequencies...
          </p>
        </div>
      )}

      {!authLoading && !user && (
        <AnimatePresence mode="wait">
          {screen === 'hero' && (
            <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
              <HeroLanding onGoLogin={() => dispatch({ type: 'NAVIGATE', screen: 'login' })} onGoRegister={() => dispatch({ type: 'NAVIGATE', screen: 'register' })} />
            </motion.div>
          )}
          {screen === 'login' && (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
              <Login onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onSwitchToRegister={() => dispatch({ type: 'NAVIGATE', screen: 'register' })} onBack={() => dispatch({ type: 'NAVIGATE', screen: 'hero' })} />
            </motion.div>
          )}
          {screen === 'register' && (
            <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
              <Register onRegister={handleRegister} onSwitchToLogin={() => dispatch({ type: 'NAVIGATE', screen: 'login' })} onBack={() => dispatch({ type: 'NAVIGATE', screen: 'hero' })} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {!authLoading && user && (
        <>
          {screen === 'choose-username' && (
            <motion.div key="choose-username" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
              <ChooseUsername onSave={handleSaveUsername} />
            </motion.div>
          )}

          <AnimatePresence>
            {shouldShowLockScreen && (
              <motion.div
                key="lock-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="z-[100] relative"
              >
                <MidnightMode onBypass={() => setDevBypass(true)} onLogout={handleLogout} battery={battery} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {screen === 'landing' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="h-screen relative z-10"
              >
                <Landing
                  onEnter={handleEntering}
                  onLogout={handleLogout}
                  audioEnabled={audioEnabled}
                  onToggleAudio={toggleAudio}
                  isTriggered={isTriggered || devBypass}
                  signalMode={currentSignalMode}
                  signalAvailability={signalAvailability}
                  username={username}
                  userEmail={user?.email}
                  battery={battery}
                  isBusy={enteringMatchRef.current}
                  sessionHistory={sessionHistory}
                />
              </motion.div>
            )}

            {screen === 'connecting' && (
              <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
                <Connecting onAbort={handleAbortMatch} onSearchAgain={handleSearchAgain} onLogout={handleLogout} audioEnabled={audioEnabled} onToggleAudio={toggleAudio} signalMode={currentSignalMode} username={username} userEmail={user?.email} startedAt={matchingStartedAt} />
              </motion.div>
            )}

            {screen === 'chat' && (
              <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative z-10">
                <Chat
                  onEndSession={handleEndSession}
                  isLowSignal={isLowSignal}
                  onToggleManualLowSignal={toggleManualLowSignal}
                  signalMode={currentSignalMode}
                  matchingStartedAt={matchingStartedAt}
                  audioEnabled={audioEnabled}
                  onToggleAudio={toggleAudio}
                  anonId={displayName}
                  roomId={roomId}
                  userId={user?.uid}
                  username={username}
                  userEmail={user?.email}
                  battery={battery}
                />
              </motion.div>
            )}

            {screen === 'disconnect' && (
              <motion.div key="disconnect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10">
                <Disconnect onReturn={handleReturnToWait} onLogout={handleLogout} username={username} userEmail={user?.email} summary={disconnectSummary} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {canInstall && (
        <button
          onClick={isIOS ? undefined : install}
          title={isIOS ? 'Tap Share → Add to Home Screen' : 'Install Last Signal'}
          className="fixed bottom-6 right-6 z-50 text-[9px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 hover:border-[#6B8AFB]/40 bg-white/5 border border-white/10 backdrop-blur-md px-4 py-2 transition-all duration-300"
        >
          {isIOS ? '↓ add to home' : '↓ install app'}
        </button>
      )}
    </div>
  )
}

export default App
