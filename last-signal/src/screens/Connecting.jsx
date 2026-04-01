import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getSignalModeConfig } from "../lib/signalModes"
import { cn } from "../lib/utils"
import { startSearchStatic, stopSearchStatic } from "../lib/audioEngine"

const SEARCH_TIMEOUT_SECONDS = 60

export default function Connecting({ onAbort, onSearchAgain, onLogout, onToggleAudio, audioEnabled, signalMode, username, userEmail, startedAt }) {
    const mode = getSignalModeConfig(signalMode)
    const [clockMs, setClockMs] = useState(() => Date.now())
    const elapsed = startedAt ? Math.max(0, Math.floor((clockMs - startedAt) / 1000)) : 0
    const timeDisplay = new Date(clockMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
    const durationMin = Math.round(mode.durationMs / 60000)
    const hasSearchTimedOut = elapsed >= SEARCH_TIMEOUT_SECONDS

    const waitingState = useMemo(() => {
        if (hasSearchTimedOut) {
            return {
                title: 'the search timed out',
                detail: 'no signal locked in this pass',
            }
        }

        if (elapsed >= 40) {
            return {
                title: 'the airwaves are quiet',
                detail: 'but another signal may appear',
            }
        }

        if (elapsed >= 20) {
            return {
                title: 'signals are faint tonight...',
                detail: 'still listening',
            }
        }

        return {
            title: 'waiting for another signal',
            detail: null,
        }
    }, [elapsed, hasSearchTimedOut])

    const signalStrength = useMemo(() => {
        if (hasSearchTimedOut) {
            return { label: 'none', level: 0 }
        }

        if (elapsed >= 35) {
            return { label: 'medium', level: 2 }
        }

        return { label: 'weak', level: 1 }
    }, [elapsed, hasSearchTimedOut])

    const searchingCopy = signalMode === 'battery' ? 'searching emergency channels...' : 'searching the airwaves...'
    const channelCopy = signalMode === 'battery' ? 'channel open - send what matters' : 'channel open - keep listening'

    useEffect(() => {
        const elapsedInterval = setInterval(() => setClockMs(Date.now()), 1000)

        return () => {
            clearInterval(elapsedInterval)
        }
    }, [])

    useEffect(() => {
        if (!audioEnabled) {
            stopSearchStatic()
            return
        }

        startSearchStatic()
        return () => stopSearchStatic()
    }, [audioEnabled])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed top-12 left-0 right-0 flex justify-between items-center px-8 z-10"
            >
                <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] tracking-[0.3em] uppercase text-white/60">{username}</span>
                    {userEmail && <span className="text-[8px] tracking-[0.15em] text-white/30 lowercase">{userEmail}</span>}
                </div>
                <div className="flex items-center gap-5">
                    <button
                        onClick={onToggleAudio}
                        className="text-[8px] tracking-[0.28em] uppercase text-white/35 hover:text-white/70 transition-colors"
                    >
                        {audioEnabled ? 'audio on' : 'audio off'}
                    </button>
                    <button
                        onClick={onLogout}
                        className="text-[9px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
                    >
                        disconnect
                    </button>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                <motion.p
                    key={searchingCopy}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-white/60 text-sm tracking-[0.2em] uppercase font-light mb-8"
                >
                    {searchingCopy}
                </motion.p>
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.12 }}
                className="mb-6 flex items-center gap-3 text-[8px] tracking-[0.24em] uppercase text-white/28"
            >
                <span>signal strength: {signalStrength.label}</span>
                <span className="flex items-end gap-1" aria-hidden="true">
                    {[1, 2, 3].map((bar) => (
                        <span
                            key={bar}
                            className={cn(
                                "w-1 rounded-sm transition-colors duration-300",
                                bar <= signalStrength.level ? mode.accentDot : 'bg-white/10',
                                bar === 1 ? 'h-2' : bar === 2 ? 'h-3' : 'h-4'
                            )}
                        />
                    ))}
                </span>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={cn("text-[9px] tracking-[0.4em] uppercase mb-4", mode.accentText)}
            >
                {mode.iconLabel}
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-[8px] tracking-[0.26em] uppercase text-white/28 mb-8"
            >
                {channelCopy}
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 mb-10"
            >
                {[0, 1, 2].map((index) => (
                    <motion.span
                        key={index}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 2.8, repeat: Infinity, delay: index * 0.35 }}
                        className={cn("w-1.5 h-1.5 rounded-full", mode.accentDot)}
                    />
                ))}
            </motion.div>

            <div className="relative w-64 h-[1px] bg-white/10 overflow-hidden mb-10">
                <motion.div
                    animate={{ x: [-100, 300] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className={cn("absolute inset-x-0 w-32 bg-gradient-to-r from-transparent to-transparent", mode.scanGlow)}
                />
                <motion.div
                    animate={{ x: [-50, 250] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                    className={cn("absolute top-[-2px] left-0 w-1 h-1 rounded-full blur-[2px]", signalMode === 'battery' ? 'bg-amber-400/60' : 'bg-blue-500/50')}
                />
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-2 mb-8 text-[8px] tracking-[0.24em] uppercase text-white/20"
            >
                <span>{mode.label}</span>
                <span className="text-white/10">·</span>
                <span>{durationMin} min signal</span>
                <span className="text-white/10">·</span>
                <span>{timeDisplay}</span>
            </motion.div>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-[9px] tracking-[0.3em] uppercase text-white/30 font-light"
            >
                {waitingState.title}
            </motion.p>

            <AnimatePresence mode="wait">
                {waitingState.detail && (
                    <motion.p
                        key={waitingState.detail}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-[8px] tracking-[0.18em] text-white/22 uppercase mt-4 max-w-sm"
                    >
                        {waitingState.detail}
                    </motion.p>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {hasSearchTimedOut ? (
                    <motion.button
                        key="search-again"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.45 }}
                        onClick={onSearchAgain}
                        className="fixed bottom-24 text-[10px] tracking-[0.4em] uppercase text-blue-400/70 hover:text-blue-300 transition-colors"
                    >
                        [ search again ]
                    </motion.button>
                ) : (
                    <motion.button
                        key="cancel"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.45, delay: 1.1 }}
                        onClick={onAbort}
                        className="fixed bottom-24 text-[10px] tracking-[0.4em] uppercase text-white/45 hover:text-white/80 transition-colors"
                    >
                        [ cancel ]
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    )
}
