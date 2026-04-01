import { useState } from "react"
import { motion } from "framer-motion"
import { Dices } from "lucide-react"
import { cn } from "../lib/utils"
import { generateUsername } from "../lib/usernameGenerator"

export default function ChooseUsername({ onSave }) {
    const [username, setUsername] = useState(generateUsername())
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [rolling, setRolling] = useState(false)

    const rollDice = () => {
        setRolling(true)
        setError("")
        let count = 0
        const interval = setInterval(() => {
            setUsername(generateUsername())
            count++
            if (count >= 6) {
                clearInterval(interval)
                setRolling(false)
            }
        }, 80)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const trimmed = username.trim().toLowerCase().replace(/\s+/g, "_")
        if (!trimmed || trimmed.length < 3) {
            setError("Signal name must be at least 3 characters")
            return
        }
        if (trimmed.length > 20) {
            setError("Signal name must be under 20 characters")
            return
        }
        if (!/^[a-z0-9_]+$/.test(trimmed)) {
            setError("Only lowercase letters, numbers, and underscores")
            return
        }
        setError("")
        setLoading(true)
        try {
            await onSave(trimmed)
        } catch (err) {
            setError(err.message || "Failed to save signal name")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-sm space-y-10"
            >
                {/* Title */}
                <div className="space-y-4">
                    <h1 className="text-3xl md:text-4xl font-light tracking-[0.2em] uppercase">
                        choose your signal
                    </h1>
                    <div className="h-[1px] w-8 bg-white/20 mx-auto" />
                    <p className="text-white/60 text-[10px] tracking-[0.3em] uppercase">
                        this name is permanent — choose wisely
                    </p>
                </div>

                {/* Username Input */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"))
                                setError("")
                            }}
                            placeholder="signal_name"
                            className="input-signal text-sm tracking-wider pr-12"
                            maxLength={20}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={rollDice}
                            disabled={rolling}
                            className={cn(
                                "absolute right-0 top-1/2 -translate-y-1/2 p-3 transition-all",
                                rolling
                                    ? "text-blue-400 animate-spin"
                                    : "text-white/40 hover:text-white/70"
                            )}
                        >
                            <Dices size={18} />
                        </button>
                    </div>

                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-400/70 text-[10px] tracking-[0.2em] uppercase"
                        >
                            {error}
                        </motion.p>
                    )}

                    <motion.button
                        type="submit"
                        disabled={loading}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                            "btn-signal w-full",
                            loading && "opacity-40 pointer-events-none"
                        )}
                    >
                        {loading ? "[ locking in... ]" : "[ lock signal name ]"}
                    </motion.button>
                </form>

                {/* Hint */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="text-white/25 text-[9px] tracking-[0.2em] uppercase"
                >
                    press the dice for a random identity
                </motion.p>
            </motion.div>

            {/* Bottom text */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="fixed bottom-12 left-0 right-0 flex justify-center text-[10px] uppercase tracking-[0.3em] text-white/25"
            >
                your identity in the void
            </motion.div>
        </div>
    )
}
