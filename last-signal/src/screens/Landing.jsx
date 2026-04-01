import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getSignalModeConfig } from "../lib/signalModes"
import { cn } from "../lib/utils"

function formatDuration(ms) {
    if (!ms) return '0m 00s'
    const totalSeconds = Math.max(0, Math.round(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function formatSessionClock(timestampMs) {
    if (!timestampMs) return '--:--'
    return new Date(timestampMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Landing({ onEnter, onLogout, onToggleAudio, audioEnabled, isTriggered, signalMode, signalAvailability, username, userEmail, battery, isBusy, sessionHistory = [] }) {
    const mode = getSignalModeConfig(signalMode)
    const [showNotice, setShowNotice] = useState(false)

    useEffect(() => {
        if (!isTriggered) return
        const timer = setTimeout(() => setShowNotice(true), 600)
        return () => clearTimeout(timer)
    }, [isTriggered])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed top-12 left-0 right-0 flex justify-between items-center px-8"
            >
                <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] tracking-[0.3em] uppercase text-white/60">{username}</span>
                    {userEmail && <span className="text-[8px] tracking-[0.15em] text-white/30 lowercase">{userEmail}</span>}
                </div>
                <div className="flex items-center gap-6">
                    <button
                        onClick={onToggleAudio}
                        className="text-[8px] tracking-[0.28em] uppercase text-white/35 hover:text-white/70 transition-colors"
                    >
                        {audioEnabled ? 'audio on' : 'audio off'}
                    </button>
                    <div className="w-12 h-[1px] bg-white/20" />
                    <button
                        onClick={onLogout}
                        className="text-[9px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
                    >
                        disconnect
                    </button>
                </div>
            </motion.nav>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
            >
                <h1 className="text-4xl md:text-5xl font-light tracking-[0.2em] uppercase">
                    last signal
                </h1>
                <p className="text-white/70 text-sm md:text-base tracking-wider font-light max-w-md mx-auto leading-relaxed">
                    conversations before the signal fades / <br className="hidden md:block" />
                    maybe this one stays with you
                </p>
            </motion.div>

            <div className="absolute bottom-18 flex flex-col items-center gap-6 w-full px-6 max-w-xl">
                <AnimatePresence>
                    {isTriggered && showNotice && (
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                            className="flex flex-col items-center gap-4"
                        >
                            <motion.div
                                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className={cn("w-2 h-2 rounded-full", mode.accentDot)}
                            />

                            <div className={cn("text-[10px] tracking-[0.4em] uppercase", mode.accentText)}>
                                {mode.statusLabel}
                            </div>
                            <div className="text-[9px] tracking-[0.3em] uppercase text-white/40">
                                {signalAvailability?.detail || mode.description}
                            </div>

                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                onClick={onEnter}
                                disabled={isBusy}
                                className="btn-signal mt-2 disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {isBusy ? '[ tuning signal ]' : '[ start signal ]'}
                            </motion.button>

                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {!isTriggered && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="glass px-6 py-5 w-full max-w-md flex flex-col items-center gap-3"
                        >
                            <div className="text-[9px] tracking-[0.3em] uppercase text-white/35">
                                {signalAvailability?.title || 'no signal detected'}
                            </div>
                            <div className="text-[8px] tracking-[0.22em] uppercase text-white/22">
                                {signalAvailability?.detail}
                            </div>
                            <div className="w-16 h-[1px] bg-white/10" />
                            <div className="flex flex-col items-center gap-1.5 mt-1">
                                {signalAvailability?.eligibility?.map((item) => (
                                    <div key={item} className="text-[8px] tracking-[0.15em] text-white/22">
                                        {item}
                                    </div>
                                ))}
                                {battery && !battery.supported && (
                                    <div className="text-[7px] tracking-[0.15em] text-white/15 mt-1">
                                        battery signal unavailable on this browser
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {sessionHistory.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed left-8 bottom-20 w-64"
                    >
                        <div className="glass px-5 py-4 border border-white/8 bg-black/25">
                            <div className="text-[8px] tracking-[0.34em] uppercase text-white/32 mb-3">past signals</div>
                            <div className="flex flex-col gap-2.5">
                                {sessionHistory.map((entry, index) => (
                                    <div key={`${entry.endedAt || index}-${entry.signalMode}`} className="flex items-center justify-between gap-3 text-[8px] uppercase tracking-[0.2em] text-white/30">
                                        <span>{entry.signalMode === 'battery' ? 'emergency' : 'midnight'}</span>
                                        <span>{formatDuration(entry.durationMs)}</span>
                                        <span>{entry.timeOfDay || 'night'}</span>
                                        <span>{entry.messagesCount || 0} msgs</span>
                                        <span>{formatSessionClock(entry.endedAt)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed bottom-8 left-0 right-0 flex justify-center text-[10px] uppercase tracking-[0.3em] text-white/35"
            >
                all connections temporary
            </motion.div>
        </div>
    )
}
