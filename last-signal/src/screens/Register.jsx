import { useState } from "react"
import { motion } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "../lib/utils"

export default function Register({ onRegister, onSwitchToLogin, onBack }) {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email.trim() || !password.trim()) return

        if (password !== confirm) {
            setError("Frequencies do not match")
            return
        }
        if (password.length < 6) {
            setError("Passphrase must be at least 6 characters")
            return
        }

        setError("")
        setLoading(true)
        try {
            await onRegister(email, password)
        } catch (err) {
            setError(err.message || "Failed to register")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            {onBack && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed top-12 left-8"
                >
                    <button
                        onClick={onBack}
                        className="text-[9px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
                    >
                        ← back
                    </button>
                </motion.div>
            )}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-sm space-y-10"
            >
                {/* Title */}
                <div className="space-y-4">
                    <h1 className="text-3xl md:text-4xl font-light tracking-[0.2em] uppercase">
                        new signal
                    </h1>
                    <div className="h-[1px] w-8 bg-white/20 mx-auto" />
                    <p className="text-white/60 text-[10px] tracking-[0.3em] uppercase">
                        register your frequency
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="signal frequency (email)"
                            className="input-signal text-sm tracking-wider"
                            autoComplete="email"
                        />
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="passphrase"
                                className="input-signal text-sm tracking-wider pr-10"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/70 transition-colors p-2"
                            >
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type={showConfirm ? "text" : "password"}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="confirm passphrase"
                                className="input-signal text-sm tracking-wider pr-10"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/70 transition-colors p-2"
                            >
                                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
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
                        {loading ? "[ calibrating... ]" : "[ lock in frequency ]"}
                    </motion.button>
                </form>

                {/* Switch to Login */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <button
                        onClick={onSwitchToLogin}
                        className="text-[10px] tracking-[0.3em] uppercase text-white/45 hover:text-white/70 transition-colors"
                    >
                        already have a signal? / tune back in
                    </button>
                </motion.div>
            </motion.div>

            {/* Bottom text */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="fixed bottom-12 left-0 right-0 flex justify-center text-[10px] uppercase tracking-[0.3em] text-white/35"
            >
                every signal starts somewhere
            </motion.div>
        </div>
    )
}
