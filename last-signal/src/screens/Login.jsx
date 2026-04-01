import { useState } from "react"
import { motion } from "framer-motion"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "../lib/utils"

export default function Login({ onLogin, onGoogleLogin, onSwitchToRegister, onBack }) {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!email.trim() || !password.trim()) return
        setError("")
        setLoading(true)
        try {
            await onLogin(email, password)
        } catch (err) {
            setError(err.message || "Failed to sign in")
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
                        last signal
                    </h1>
                    <div className="h-[1px] w-8 bg-white/20 mx-auto" />
                    <p className="text-white/60 text-[10px] tracking-[0.3em] uppercase">
                        reconnect to the void
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
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/45 hover:text-white/70 transition-colors p-2"
                            >
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
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
                        {loading ? "[ tuning in... ]" : "[ transmit ]"}
                    </motion.button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-[1px] bg-white/10" />
                    <span className="text-white/40 text-[9px] tracking-[0.3em] uppercase">or</span>
                    <div className="flex-1 h-[1px] bg-white/10" />
                </div>

                {/* Google Sign-in */}
                <motion.button
                    type="button"
                    onClick={async () => {
                        setError("")
                        setLoading(true)
                        try {
                            await onGoogleLogin()
                        } catch (err) {
                            setError(err.message || "Google sign-in failed")
                        } finally {
                            setLoading(false)
                        }
                    }}
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                        "btn-signal w-full",
                        loading && "opacity-40 pointer-events-none"
                    )}
                >
                    [ sign in with google ]
                </motion.button>

                {/* Switch to Register */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                >
                    <button
                        onClick={onSwitchToRegister}
                        className="text-[10px] tracking-[0.3em] uppercase text-white/45 hover:text-white/70 transition-colors"
                    >
                        no signal yet? / register a new frequency
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
                all connections temporary
            </motion.div>
        </div>
    )
}
