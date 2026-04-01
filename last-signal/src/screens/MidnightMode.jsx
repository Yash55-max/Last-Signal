import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Lock, Unlock } from "lucide-react"

export default function MidnightMode({ onBypass, onLogout, battery }) {
    const [timer, setTimer] = useState(() => {
        const now = new Date()
        const end = new Date()
        end.setHours(24, 0, 0, 0)
        const diff = end.getTime() - now.getTime()
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0')
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
        return `${h}:${m}:${s}`
    })
    const [isHovered, setIsHovered] = useState(false)

    // Countdown to next midnight (when midnight mode opens)
    useEffect(() => {
        const updateTimer = () => {
            const now = new Date()
            const end = new Date()
            end.setHours(24, 0, 0, 0) // rolls over to 12:00 AM tomorrow

            const diff = end.getTime() - now.getTime()

            const h = Math.floor(diff / 3600000).toString().padStart(2, '0')
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')

            setTimer(`${h}:${m}:${s}`)
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 text-center bg-black">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed top-12 right-8 z-[101]"
            >
                <button
                    onClick={onLogout}
                    className="text-[9px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
                >
                    disconnect
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass p-12 max-w-sm w-full space-y-8 rounded-3xl relative overflow-hidden"
            >
                {/* Bypass logic: Double click the lock to bypass for testing */}
                <motion.div
                    onDoubleClick={onBypass}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="flex justify-center text-primary cursor-help"
                    title="Double click to bypass lock (Dev only)"
                >
                    {isHovered ? <Unlock size={32} strokeWidth={1.5} className="text-white/45" /> : <Lock size={32} strokeWidth={1.5} />}
                </motion.div>

                <div className="space-y-2">
                    <h3 className="text-sm font-light tracking-[0.3em] uppercase text-white/75">
                        MIDNIGHT MODE
                    </h3>
                    <div className="h-[1px] w-8 bg-primary/30 mx-auto" />
                </div>

                <div className="text-6xl font-light tracking-widest text-white/90 font-mono">
                    {timer.split(':').map((part, i) => (
                        <span key={i}>
                            {part}{i < 2 ? <span className="text-white/45 select-none">:</span> : ''}
                        </span>
                    ))}
                </div>

                <div className="space-y-4 pt-4">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-white/60 leading-relaxed max-w-[220px] mx-auto">
                        next window opens at midnight
                    </p>
                    <p className="text-[9px] tracking-[0.15em] text-white/40 leading-relaxed max-w-[200px] mx-auto">
                        • battery falls below 10%<br />
                        • late night between 12–4am
                    </p>
                    {battery && !battery.supported && (
                        <p className="text-[8px] tracking-[0.15em] text-white/25 max-w-[200px] mx-auto">
                            battery signal unavailable<br />midnight mode still active
                        </p>
                    )}
                </div>

                {/* Ambient glow */}
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/5 blur-[80px] rounded-full" />
            </motion.div>

            <div className="fixed bottom-12 flex gap-2">
                {[1, 0.4, 0.4, 0.4].map((op, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-white transition-opacity" style={{ opacity: op * 0.2 }} />
                ))}
            </div>

            <div className="fixed bottom-12 left-0 right-0 text-[10px] uppercase tracking-[0.3em] text-white/30">
                LAST SIGNAL
            </div>
        </div>
    )
}
