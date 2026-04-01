import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUp, BatteryLow, Flag, Volume2, VolumeX, Wifi, WifiLow, X } from "lucide-react"
import { cn } from "../lib/utils"
import {
    HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_STALE_AFTER_MS,
    HEARTBEAT_TERMINATION_DELAY_MS,
    leaveChat,
    listenMessages,
    listenRoomStatus,
    markRoomPresence,
    reportIncident,
    sendMessage,
} from "../lib/chat"
import { canSendMessage, containsToxic } from "../lib/moderation"
import { getSignalModeConfig } from "../lib/signalModes"
import { playFadeOutNoise, playMatchTone, playWarningPulse } from "../lib/audioEngine"

const SIGNAL_FADING_ANIMATION_MS = 3800

export default function Chat({ onEndSession, isLowSignal, onToggleManualLowSignal, signalMode, matchingStartedAt, audioEnabled, onToggleAudio, anonId, roomId, userId, username, userEmail, battery }) {
    const mode = getSignalModeConfig(signalMode)
    const shouldShowTimeLimit = Boolean(matchingStartedAt)
    const initialTime = Math.floor(mode.durationMs / 1000)
    const durationMin = Math.round(mode.durationMs / 60000)
    const [sessionTime] = useState(() =>
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
    )
    const halfTime = Math.floor(initialTime / 2)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")
    const [timeLeft, setTimeLeft] = useState(initialTime)
    const [fadingMessage, setFadingMessage] = useState(null)
    const [showIntroCard, setShowIntroCard] = useState(() => shouldShowTimeLimit)
    const [chatActive, setChatActive] = useState(true)
    const [signalLost, setSignalLost] = useState(false)
    const [blocked, setBlocked] = useState(null)
    const [isSending, setIsSending] = useState(false)
    const [remotePresence, setRemotePresence] = useState(null)
    const [remoteDisconnectPhase, setRemoteDisconnectPhase] = useState(null)
    const [signalLossReason, setSignalLossReason] = useState(null)
    const [exitSequence, setExitSequence] = useState(null)
    const [reportState, setReportState] = useState(null)
    const [localConnection, setLocalConnection] = useState(typeof navigator !== 'undefined' && navigator.onLine ? 'connected' : 'offline')
    const scrollRef = useRef(null)
    const leavingRef = useRef(false)
    const matchToneFiredRef = useRef(false)
    const disconnectWarningTimeoutRef = useRef(null)
    const disconnectTerminationTimeoutRef = useRef(null)
    const exitTimeoutRef = useRef(null)
    const typingTimeoutRef = useRef(null)
    const localTypingRef = useRef(false)
    const lastPresenceRef = useRef(0)
    // Ref so handleLeave can read the latest timeLeft without re-creating every second.
    const timeLeftRef = useRef(timeLeft)

    const clearDisconnectTimers = useCallback(() => {
        if (disconnectWarningTimeoutRef.current) {
            clearTimeout(disconnectWarningTimeoutRef.current)
            disconnectWarningTimeoutRef.current = null
        }

        if (disconnectTerminationTimeoutRef.current) {
            clearTimeout(disconnectTerminationTimeoutRef.current)
            disconnectTerminationTimeoutRef.current = null
        }
    }, [])

    const clearExitTimer = useCallback(() => {
        if (exitTimeoutRef.current) {
            clearTimeout(exitTimeoutRef.current)
            exitTimeoutRef.current = null
        }
    }, [])

    // Keep timeLeftRef in sync so handleLeave can read it without being in deps.
    useEffect(() => {
        timeLeftRef.current = timeLeft
    }, [timeLeft])

    const buildChatTranscript = useCallback(() => {
        return messages.map((msg, index) => {
            const isMe = msg.senderId === userId
            const createdAtMs = typeof msg.createdAt?.toMillis === 'function'
                ? msg.createdAt.toMillis()
                : Number.isFinite(msg.createdAt?.seconds)
                    ? msg.createdAt.seconds * 1000
                    : null

            return {
                id: msg.id || `${createdAtMs || Date.now()}-${index}`,
                sender: isMe ? 'you' : 'other',
                senderLabel: isMe ? (anonId || 'YOU') : (msg.senderName || 'OTHER'),
                text: msg.text || '',
                timestamp: createdAtMs,
                batteryPercent: Number.isFinite(msg.batteryPercent) ? Math.round(msg.batteryPercent) : null,
            }
        })
    }, [anonId, messages, userId])

    const handleLeave = useCallback(async (reason = 'ended', options = {}) => {
        if (leavingRef.current) return
        leavingRef.current = true

        clearDisconnectTimers()
        clearExitTimer()
        setShowIntroCard(false)
        setRemoteDisconnectPhase(null)
        setSignalLossReason(reason)
        setSignalLost(true)
        setChatActive(false)
        setExitSequence({ reason })

        if (roomId && !options.skipRemoteUpdate) {
            try {
                await leaveChat(roomId)
            } catch {
                // The room may already be closed by the remote user.
            }
        }

        exitTimeoutRef.current = setTimeout(async () => {
            exitTimeoutRef.current = null

            try {
                await onEndSession({
                    reason,
                    // Use ref so this closure always reads the latest countdown value.
                    durationMs: Math.max(0, mode.durationMs - (timeLeftRef.current * 1000)),
                    messagesCount: messages.length,
                    chatTranscript: buildChatTranscript(),
                    skipRemoteUpdate: true,
                })
            } finally {
                setExitSequence(null)
                leavingRef.current = false
            }
        }, SIGNAL_FADING_ANIMATION_MS)
    }, [buildChatTranscript, clearDisconnectTimers, clearExitTimer, messages.length, mode.durationMs, onEndSession, roomId])

    useEffect(() => {
        if (!shouldShowTimeLimit) {
            setShowIntroCard(false)
            return
        }

        const timeoutId = setTimeout(() => {
            setShowIntroCard(false)
        }, 3000)

        return () => clearTimeout(timeoutId)
    }, [shouldShowTimeLimit])

    useEffect(() => {
        if (!roomId) return
        const unsub = listenMessages(roomId, (msgs) => {
            setMessages(msgs)
        })
        return () => unsub()
    }, [roomId])

    useEffect(() => {
        if (!roomId) return
        const unsub = listenRoomStatus(roomId, (status, data) => {
            if (status === "user_left" || status === "ended") {
                if (!leavingRef.current) {
                    handleLeave('partner_left', { skipRemoteUpdate: true })
                }
                return
            }

            if (data?.expiresAt) {
                const expMs = typeof data.expiresAt.toMillis === 'function' ? data.expiresAt.toMillis() : data.expiresAt
                const remaining = Math.max(0, Math.floor((expMs - Date.now()) / 1000))
                setTimeLeft(remaining)
            }

            if (data?.users && data?.participantState && userId) {
                const remoteUid = data.users.find((uid) => uid !== userId)
                if (remoteUid) {
                    setRemotePresence(data.participantState[remoteUid] || null)
                }
            }
        })
        return () => unsub()
    }, [handleLeave, roomId, userId])

    const publishPresence = useCallback(async (connection, visibility = document.visibilityState === 'visible' ? 'visible' : 'hidden', options = {}) => {
        if (!roomId || !userId) return

        // Throttle to at most one Firestore write per 800ms to prevent write storms
        // on rapid network-state changes. Heartbeat fires every 5000ms so it always passes.
        const now = Date.now()
        if (now - lastPresenceRef.current < 800) return
        lastPresenceRef.current = now

        try {
            await markRoomPresence(roomId, userId, {
                connection,
                visibility,
                isTyping: options.isTyping,
                touchActivity: options.touchActivity ?? false,
            })
        } catch {
            // Ignore presence update failures during short disconnects.
        }
    }, [roomId, userId])

    const setTypingState = useCallback((isTyping) => {
        if (!roomId || !userId) return
        if (localTypingRef.current === isTyping) return

        localTypingRef.current = isTyping
        publishPresence(navigator.onLine ? 'connected' : 'offline', undefined, { isTyping })
    }, [publishPresence, roomId, userId])

    useEffect(() => {
        if (!roomId || !userId) return
        publishPresence(navigator.onLine ? 'connected' : 'offline')

        const heartbeatId = setInterval(() => {
            publishPresence(navigator.onLine ? 'connected' : 'offline')
        }, HEARTBEAT_INTERVAL_MS)

        const handleOnline = () => {
            setLocalConnection('connected')
            publishPresence('connected')
        }
        const handleOffline = () => {
            setLocalConnection('offline')
            publishPresence('offline')
        }
        const handleVisibility = () => {
            publishPresence(navigator.onLine ? 'connected' : 'offline')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            clearInterval(heartbeatId)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            document.removeEventListener('visibilitychange', handleVisibility)
            publishPresence('reconnecting')
        }
        // localConnection is intentionally omitted from deps — event handlers update it directly.
        // Including it re-mounts this effect on every network change, firing a spurious
        // 'reconnecting' presence update and registering duplicate event listeners.
    }, [publishPresence, roomId, userId])

    useEffect(() => {
        if (!chatActive || signalLost) return

        const remoteLastSeenMs = typeof remotePresence?.lastSeenAt?.toMillis === 'function'
            ? remotePresence.lastSeenAt.toMillis()
            : remotePresence?.lastSeenAt ?? null

        if (!remotePresence || !remoteLastSeenMs) {
            setRemoteDisconnectPhase(null)
            clearDisconnectTimers()
            return
        }

        const checkRemoteHeartbeat = () => {
            const heartbeatAgeMs = Date.now() - remoteLastSeenMs
            const remoteMissing = remotePresence.connection === 'offline' || heartbeatAgeMs > HEARTBEAT_STALE_AFTER_MS

            if (!remoteMissing) {
                setRemoteDisconnectPhase(null)
                clearDisconnectTimers()
                return
            }

            setRemoteDisconnectPhase('unstable')

            if (!disconnectWarningTimeoutRef.current) {
                disconnectWarningTimeoutRef.current = setTimeout(() => {
                    disconnectWarningTimeoutRef.current = null
                    setRemoteDisconnectPhase('terminated')
                    setSignalLossReason('partner_disconnected')

                    disconnectTerminationTimeoutRef.current = setTimeout(() => {
                        disconnectTerminationTimeoutRef.current = null
                        handleLeave('partner_disconnected', { skipRemoteUpdate: true })
                    }, 1800)
                }, HEARTBEAT_TERMINATION_DELAY_MS)
            }
        }

        checkRemoteHeartbeat()

        const intervalId = setInterval(checkRemoteHeartbeat, 1000)
        return () => clearInterval(intervalId)
    }, [chatActive, clearDisconnectTimers, handleLeave, remotePresence, signalLost])

    useEffect(() => {
        if (!audioEnabled || matchToneFiredRef.current) return
        matchToneFiredRef.current = true
        playMatchTone()
    }, [audioEnabled])

    const isWarningWindow = timeLeft > 0 && timeLeft <= 30

    useEffect(() => {
        if (!audioEnabled || !chatActive || signalLost || !isWarningWindow) return

        playWarningPulse()
        const pulseId = setInterval(() => playWarningPulse(), 6000)
        return () => clearInterval(pulseId)
    }, [audioEnabled, chatActive, isWarningWindow, signalLost])

    useEffect(() => {
        if (!audioEnabled || !exitSequence) return
        playFadeOutNoise()
    }, [audioEnabled, exitSequence])

    useEffect(() => {
        if (timeLeft <= 0) {
            handleLeave('signal_faded')
            return
        }
        if (!chatActive) return

        if (!shouldShowTimeLimit || timeLeft > halfTime) {
            setFadingMessage(null)
        } else if (timeLeft <= 10) {
            setFadingMessage("last transmission")
        } else if (timeLeft <= 30) {
            setFadingMessage("signal critical")
        } else {
            setFadingMessage(mode.id === 'battery' ? 'battery collapsing' : 'the signal is fading')
        }

        const interval = setInterval(() => setTimeLeft((value) => value - 1), 1000)
        return () => clearInterval(interval)
    }, [chatActive, halfTime, handleLeave, mode.id, shouldShowTimeLimit, timeLeft])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60).toString().padStart(2, "0")
        const remainder = (seconds % 60).toString().padStart(2, "0")
        return `${minutes}:${remainder}`
    }


    const handleSend = async () => {
        if (!input.trim() || !roomId || !userId || !chatActive || isSending) return

        if (!canSendMessage()) {
            setBlocked("slow down... one message at a time")
            setTimeout(() => setBlocked(null), 1500)
            return
        }

        if (containsToxic(input)) {
            setBlocked("message blocked — keep the signal clean")
            setTimeout(() => setBlocked(null), 2000)
            setInput("")
            return
        }

        const text = input
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = null
        }
        setTypingState(false)
        const messageBatteryPercent = mode.id === 'battery' && battery?.supported && Number.isFinite(battery?.level)
            ? Math.max(0, Math.min(100, Math.round(battery.level)))
            : null
        setInput("")
        setIsSending(true)
        try {
            await sendMessage(roomId, userId, username, text, { batteryPercent: messageBatteryPercent })
        } finally {
            setIsSending(false)
        }
    }

    useEffect(() => () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = null
        }
        if (localTypingRef.current) {
            publishPresence('reconnecting', undefined, { isTyping: false })
            localTypingRef.current = false
        }
        clearDisconnectTimers()
        clearExitTimer()
    }, [clearDisconnectTimers, clearExitTimer, publishPresence])

    const handleInputChange = (nextValue) => {
        setInput(nextValue)
        const hasText = nextValue.trim().length > 0

        if (!hasText) {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
                typingTimeoutRef.current = null
            }
            setTypingState(false)
            return
        }

        setTypingState(true)
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
            typingTimeoutRef.current = null
            setTypingState(false)
        }, 1200)
    }

    const handleReport = async () => {
        if (!roomId || !userId) return

        try {
            await reportIncident(roomId, userId, { reason: 'manual_report', signalMode: mode.id })
            setReportState('report sent')
        } catch {
            setReportState('report failed')
        }

        setTimeout(() => setReportState(null), 2200)
    }

    const signalLostTitle = signalLossReason === 'partner_disconnected' ? 'connection terminated' : 'the signal faded'
    // 'ended' = this user left, 'partner_left' = other user left, 'partner_disconnected' = network drop
    const signalLostBody = signalLossReason === 'partner_disconnected'
        ? 'the other connection was lost'
        : signalLossReason === 'ended'
            ? 'you closed the channel'
            : 'the other user left'
    const showTimer = shouldShowTimeLimit && timeLeft <= halfTime
    const introTitle = mode.id === 'battery' ? 'emergency channel' : 'midnight channel'
    const introDuration = mode.id === 'battery' ? 'you have 3 minutes' : 'you have 5 minutes'
    const introBody = mode.id === 'battery'
        ? 'low battery. conversation window is limited'
        : 'the signal may fade without warning'

    const remoteDisconnectDetail = remoteDisconnectPhase === 'terminated'
        ? 'connection terminated'
        : remoteDisconnectPhase === 'unstable'
            ? 'the other connection was lost'
            : null

    const showRemoteDisconnectBanner = Boolean(remoteDisconnectPhase) && !signalLost
    const remoteIsTyping = Boolean(remotePresence?.isTyping) && !showRemoteDisconnectBanner && !signalLost

    const connectionWarning = !exitSequence && !showRemoteDisconnectBanner && !signalLost && (localConnection !== 'connected' || (remotePresence && remotePresence.connection !== 'connected'))
        ? (localConnection !== 'connected' ? 'your connection is unstable' : mode.reconnectCopy)
        : null
    const exitSequenceBody = exitSequence?.reason === 'partner_disconnected'
        ? 'the other connection was lost'
        : exitSequence?.reason === 'partner_left'
            ? 'the other voice is falling out of range'
            : exitSequence?.reason === 'signal_faded'
                ? 'the channel is dissolving into static'
                : 'closing the channel'
        

    return (
        <div className={cn(
            "relative flex flex-col h-screen max-w-2xl mx-auto border-x border-white/5 bg-background transition-all duration-1000 overflow-hidden",
            isLowSignal && "opacity-90 saturate-75 brightness-90"
        )}>
            <AnimatePresence>
                {exitSequence && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45 }}
                        className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
                    >
                        <motion.div
                            initial={{ opacity: 0.12, scale: 1 }}
                            animate={{ opacity: [0.18, 0.34, 0.9], scale: [1, 1.02, 1.08] }}
                            transition={{ duration: SIGNAL_FADING_ANIMATION_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),rgba(6,6,8,0.94)_58%,rgba(2,2,3,0.98)_100%)]"
                        />
                        <motion.div
                            initial={{ opacity: 0.08 }}
                            animate={{ opacity: [0.06, 0.16, 0.04, 0.18] }}
                            transition={{ duration: 0.8, repeat: 4, ease: "easeInOut" }}
                            className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.06)_48%,transparent_100%)]"
                        />
                        <motion.div
                            initial={{ y: '-15%', opacity: 0 }}
                            animate={{ y: ['-10%', '110%'], opacity: [0, 0.35, 0] }}
                            transition={{ duration: 2.7, repeat: 1, ease: 'linear' }}
                            className={cn("absolute inset-x-0 h-24 blur-2xl", mode.id === 'battery' ? 'bg-amber-300/18' : 'bg-blue-300/16')}
                        />
                        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                            <motion.div
                                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                                animate={{ opacity: [0, 1, 1, 0.2], y: [18, 0, 0, -12], scale: [0.98, 1, 1.01, 1.03] }}
                                transition={{ duration: SIGNAL_FADING_ANIMATION_MS / 1000, ease: [0.16, 1, 0.3, 1] }}
                                className="flex flex-col items-center gap-4"
                            >
                                <div className={cn("text-[10px] tracking-[0.52em] uppercase", mode.accentText)}>signal fading</div>
                                <div className="text-[11px] tracking-[0.32em] uppercase text-white/55">{exitSequenceBody}</div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showIntroCard && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/28 px-6"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 18, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -12, scale: 0.98 }}
                            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                            className="glass w-full max-w-md border-white/12 bg-black/30 px-8 py-7 text-center"
                        >
                            <div className="text-[8px] tracking-[0.28em] uppercase text-white/35">signal strength: strong</div>
                            <div className={cn("mt-2 text-[9px] tracking-[0.34em] uppercase", mode.accentText)}>connection found</div>
                            <div className={cn("text-[10px] tracking-[0.42em] uppercase", mode.accentText)}>{introTitle}</div>
                            <div className="mt-4 text-xl tracking-[0.2em] uppercase text-white/90">{introDuration}</div>
                            <div className="mt-3 text-[10px] tracking-[0.26em] uppercase text-white/42">{introBody}</div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="flex items-center justify-between px-6 py-8 gap-4">
                <div className="flex flex-col gap-1">
                    <div className="text-[10px] tracking-[0.3em] uppercase text-white/60">{username}</div>
                    {userEmail && <div className="text-[8px] tracking-[0.15em] text-white/30 lowercase">{userEmail}</div>}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onToggleManualLowSignal}
                            className={cn(
                                "flex items-center gap-2 text-[8px] tracking-[0.2em] font-light uppercase transition-colors",
                                isLowSignal ? "text-blue-400" : "text-white/35 hover:text-white/50"
                            )}
                        >
                            {isLowSignal ? (
                                <><WifiLow size={8} /> LOW SIGNAL MODE ACTIVE</>
                            ) : (
                                <><Wifi size={8} /> STABLE SIGNAL</>
                            )}
                        </button>
                        <button
                            onClick={onToggleAudio}
                            className="flex items-center gap-1 text-[8px] tracking-[0.2em] uppercase text-white/35 hover:text-white/65 transition-colors"
                        >
                            {audioEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                            {audioEnabled ? 'audio on' : 'audio off'}
                        </button>
                    </div>
                </div>
                <div className="min-w-[7rem] text-center">
                    <AnimatePresence mode="wait">
                        {showTimer ? (
                            <motion.div
                                key="timer"
                                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: [1, 1.03, 1] }}
                                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                className="flex flex-col items-center gap-1"
                            >
                                <div className={cn("text-xs font-mono tracking-[0.35em] blur-[0.3px]", mode.accentSolid)}>{formatTime(timeLeft)}</div>
                                <div className="text-[8px] tracking-[0.28em] uppercase text-white/36">remaining</div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="hidden-timer"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-1"
                            >
                                <div className={cn("text-[8px] tracking-[0.28em] uppercase", mode.accentText)}>{mode.label}</div>
                                <div className="text-[7px] tracking-[0.22em] uppercase text-white/25">{durationMin} min signal</div>
                                <div className="text-[7px] tracking-[0.16em] text-white/18">{sessionTime}</div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={() => handleLeave('ended')}
                        className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-white/60 hover:text-white/90 transition-colors disabled:opacity-50"
                        disabled={leavingRef.current}
                    >
                        END SESSION <X size={12} />
                    </button>
                    <button
                        onClick={handleReport}
                        className="flex items-center gap-1 text-[8px] tracking-[0.24em] uppercase text-white/25 hover:text-red-300/75 transition-colors"
                    >
                        <Flag size={10} /> report
                    </button>
                </div>
            </header>

            <div className="flex flex-col items-center justify-center p-4">
                <AnimatePresence mode="wait">
                    {fadingMessage ? (
                        <motion.div
                            key={fadingMessage}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={cn(
                                "text-[9px] tracking-[0.4em] uppercase mb-2",
                                timeLeft <= 10 ? "text-red-400/70" : timeLeft <= 30 ? "text-red-300/60" : mode.id === 'battery' ? "text-amber-300/60" : "text-blue-300/60"
                            )}
                        >
                            {fadingMessage}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="connected"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn("text-[9px] tracking-[0.4em] uppercase mb-2", mode.accentText)}
                        >
                            {mode.iconLabel}
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {connectionWarning && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-[8px] tracking-[0.28em] uppercase text-white/28"
                        >
                            {connectionWarning}
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {showRemoteDisconnectBanner && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="mt-3 flex flex-col items-center gap-1 text-[8px] tracking-[0.32em] uppercase text-white/35"
                        >
                            <div className="text-white/55">signal unstable</div>
                            <div>{remoteDisconnectDetail}</div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {remoteIsTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: -3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            className="mt-2 text-[8px] tracking-[0.25em] uppercase text-white/26"
                        >
                            partner typing . . .
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {reportState && (
                        <motion.div
                            initial={{ opacity: 0, y: -3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            className="mt-2 text-[8px] tracking-[0.25em] uppercase text-red-200/55"
                        >
                            {reportState}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 space-y-8 py-8 scroll-smooth"
            >
                <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                        const isMe = msg.senderId === userId
                        const time = msg.createdAt
                            ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '...'
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "flex flex-col max-w-[85%]",
                                    isMe ? "ml-auto items-end text-right" : "mr-auto items-start text-left"
                                )}
                            >
                                <div className={cn(
                                    "glass px-6 py-4 text-sm md:text-base leading-relaxed tracking-wide font-light",
                                    isMe ? "rounded-l-2xl rounded-tr-2xl" : "rounded-r-2xl rounded-tl-2xl",
                                    isLowSignal && "border-blue-500/10"
                                )}>
                                    {msg.text}
                                </div>
                                <span className="text-[9px] tracking-[0.2em] uppercase text-white/45 mt-2">
                                    {isMe ? `${anonId || 'YOU'} • ${time}` : `${msg.senderName || 'OTHER'} • ${time}`}
                                    {mode.id === 'battery' && Number.isFinite(msg.batteryPercent) ? ` • ${Math.round(msg.batteryPercent)}%` : ''}
                                </span>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
                <div className="text-[24px] text-white/35 tracking-[0.4em] pt-4">...</div>
            </div>

            <AnimatePresence>
                {signalLost && !exitSequence && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-6 py-8 px-6"
                    >
                        <div className="w-16 h-[1px] bg-white/10" />
                        <div className="text-[10px] tracking-[0.4em] uppercase text-white/50">{signalLostTitle}</div>
                        <div className="text-[9px] tracking-[0.3em] uppercase text-white/35">{signalLostBody}</div>
                        <button
                            onClick={() => onEndSession({ reason: signalLossReason || 'partner_left', durationMs: Math.max(0, mode.durationMs - (timeLeft * 1000)), messagesCount: messages.length, chatTranscript: buildChatTranscript(), skipRemoteUpdate: true })}
                            className="mt-2 text-[10px] tracking-[0.3em] uppercase text-blue-400/60 hover:text-blue-400 transition-colors"
                        >
                            [ return to matching ]
                        </button>
                        <div className="w-16 h-[1px] bg-white/10" />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={cn("p-6 space-y-4", !chatActive && "opacity-30 pointer-events-none")}>
                <AnimatePresence>
                    {blocked && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-[9px] tracking-[0.3em] uppercase text-red-400/60 text-center pb-2"
                        >
                            {blocked}
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className="relative">
                    <input
                        type="text"
                        placeholder={signalLost ? "Signal lost..." : isLowSignal ? "Signal weak... type carefully..." : "Type a message..."}
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        onBlur={() => setTypingState(false)}
                        disabled={!chatActive}
                        className="input-signal pr-12"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isSending}
                        className="absolute right-0 bottom-4 p-2 text-white/50 hover:text-white disabled:opacity-0 transition-all cursor-pointer"
                    >
                        <ArrowUp size={20} />
                    </button>
                </div>
                <div className="flex justify-between items-center text-[9px] tracking-[0.3em] uppercase text-white/35 px-1">
                    <span>ENCRYPTED CHANNEL</span>
                    <span className="flex items-center gap-1">
                        {isLowSignal && <BatteryLow size={10} className="text-red-500/50" />}
                        RETURN TO SEND
                    </span>
                </div>
            </div>
        </div>
    )
}
