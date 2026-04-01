import { useState, useEffect } from "react"
import { motion } from "framer-motion"

const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 15 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-50px" },
    transition: { duration: 1, delay, ease: [0.16, 1, 0.3, 1] },
})

export default function HeroLanding({ onGoLogin, onGoRegister }) {
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1500)
        return () => clearTimeout(timer)
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-white/50 text-[10px] tracking-[0.4em] uppercase"
                >
                    searching the airwaves...
                </motion.p>
            </div>
        )
    }

    return (
        <div className="min-h-screen overflow-y-auto scroll-smooth">

            {/* ─── Hero ─────────────────────────────── */}
            <section className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative">
                <motion.div {...fade(0.2)} className="space-y-8 max-w-lg">
                    <div className="flex items-center justify-center gap-3 text-[10px] tracking-[0.4em] uppercase text-white/35 mb-4">
                        <div className="w-8 h-[1px] bg-white/15" />
                        <span>📡</span>
                        <div className="w-8 h-[1px] bg-white/15" />
                    </div>

                    <h1 className="text-5xl md:text-6xl font-light tracking-[0.2em] uppercase leading-tight">
                        last signal
                    </h1>

                    <p className="text-white/60 text-sm md:text-base tracking-wider font-light leading-relaxed">
                        conversations before the signal fades
                    </p>

                    <p className="text-white/40 text-xs tracking-wide font-light leading-relaxed max-w-sm mx-auto">
                        sometimes the most meaningful words<br />
                        are said when time is almost gone.
                    </p>

                    <motion.div {...fade(0.6)} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                        <button onClick={onGoLogin} className="btn-signal">
                            [ start listening ]
                        </button>
                        <button
                            onClick={onGoRegister}
                            className="text-[10px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
                        >
                            create signal identity
                        </button>
                    </motion.div>
                </motion.div>

                {/* Scroll hint */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="absolute bottom-10 flex flex-col items-center gap-2"
                >
                    <motion.div
                        animate={{ y: [0, 6, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-[1px] h-6 bg-gradient-to-b from-white/20 to-transparent"
                    />
                </motion.div>
            </section>

            <div className="flex justify-center"><div className="w-24 h-[1px] bg-white/10" /></div>

            {/* ─── Quote ────────────────────────────── */}
            <section className="min-h-[60vh] flex items-center justify-center p-8">
                <motion.div {...fade()} className="max-w-md text-center space-y-6">
                    <div className="w-12 h-[1px] bg-white/10 mx-auto" />
                    <blockquote className="text-lg md:text-xl font-light tracking-wide leading-relaxed text-white/60 italic">
                        "the most honest conversations happen<br />
                        when nothing is meant to last."
                    </blockquote>
                    <div className="w-12 h-[1px] bg-white/10 mx-auto" />
                </motion.div>
            </section>

            <div className="flex justify-center"><div className="w-24 h-[1px] bg-white/10" /></div>

            {/* ─── How It Works ─────────────────────── */}
            <section className="py-24 px-6">
                <motion.div {...fade()} className="text-center mb-16">
                    <p className="text-[10px] tracking-[0.4em] uppercase text-white/35 mb-4">how it works</p>
                    <div className="w-16 h-[1px] bg-white/10 mx-auto" />
                </motion.div>

                <div className="max-w-2xl mx-auto grid gap-16 md:gap-20">
                    {[
                        { icon: "⚡", title: "a signal appears", desc: "when the moment is right — late at night, low battery — the signal activates." },
                        { icon: "📡", title: "two strangers connect", desc: "anonymous, temporary. no profiles, no history. just two people in the static." },
                        { icon: "🌙", title: "the signal fades", desc: "the timer runs out. the conversation disappears. the moment becomes a memory." },
                    ].map((step, i) => (
                        <motion.div key={i} {...fade(i * 0.15)} className="text-center space-y-3">
                            <div className="text-2xl mb-2">{step.icon}</div>
                            <h3 className="text-sm tracking-[0.3em] uppercase text-white/70 font-light">{step.title}</h3>
                            <p className="text-xs tracking-wide text-white/40 font-light max-w-xs mx-auto leading-relaxed">{step.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            <div className="flex justify-center"><div className="w-24 h-[1px] bg-white/10" /></div>

            {/* ─── Features ─────────────────────────── */}
            <section className="py-24 px-6">
                <motion.div {...fade()} className="text-center mb-16">
                    <p className="text-[10px] tracking-[0.4em] uppercase text-white/35 mb-4">features</p>
                    <div className="w-16 h-[1px] bg-white/10 mx-auto" />
                </motion.div>

                <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-10">
                    {[
                        { icon: "⚡", title: "Time-Limited Conversations", desc: "Chats end automatically. Every moment matters." },
                        { icon: "🕶", title: "Anonymous Identities", desc: "No profiles. Only signal names." },
                        { icon: "🌙", title: "Rare Activation", desc: "Signals appear only during special moments." },
                        { icon: "📡", title: "Instant Matching", desc: "Find another signal in seconds." },
                    ].map((feat, i) => (
                        <motion.div
                            key={i}
                            {...fade(i * 0.1)}
                            className="glass p-6 rounded-xl text-center space-y-3"
                        >
                            <div className="text-xl">{feat.icon}</div>
                            <h4 className="text-[11px] tracking-[0.25em] uppercase text-white/70 font-light">{feat.title}</h4>
                            <p className="text-[11px] tracking-wide text-white/40 font-light leading-relaxed">{feat.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            <div className="flex justify-center"><div className="w-24 h-[1px] bg-white/10" /></div>

            {/* ─── Example Chat ─────────────────────── */}
            <section className="py-24 px-6">
                <motion.div {...fade()} className="text-center mb-12">
                    <p className="text-[10px] tracking-[0.4em] uppercase text-white/35 mb-4">a moment in the static</p>
                    <div className="w-16 h-[1px] bg-white/10 mx-auto" />
                </motion.div>

                <motion.div {...fade(0.2)} className="max-w-sm mx-auto space-y-5">
                    {[
                        { name: "midnight_echo", text: "hey", align: "left" },
                        { name: "silent_orbit", text: "hi", align: "right" },
                        { name: "midnight_echo", text: "strange place to meet someone", align: "left" },
                        { name: "silent_orbit", text: "maybe that's why it works", align: "right" },
                    ].map((msg, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.2 + 0.3, duration: 0.6 }}
                            className={`flex flex-col ${msg.align === "right" ? "items-end" : "items-start"}`}
                        >
                            <span className="text-[8px] tracking-[0.2em] uppercase text-white/30 mb-1">{msg.name}</span>
                            <div className={`glass px-5 py-3 text-sm font-light tracking-wide text-white/70 ${msg.align === "right" ? "rounded-l-xl rounded-tr-xl" : "rounded-r-xl rounded-tl-xl"}`}>
                                {msg.text}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            <div className="flex justify-center"><div className="w-24 h-[1px] bg-white/10" /></div>

            {/* ─── Final CTA ───────────────────────── */}
            <section className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
                <motion.div {...fade()} className="space-y-8">
                    <motion.div
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-blue-500/60 mx-auto shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                    />

                    <p className="text-white/50 text-sm tracking-[0.2em] uppercase font-light">
                        a signal might be waiting
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={onGoLogin} className="btn-signal">
                            [ enter the network ]
                        </button>
                        <button
                            onClick={onGoRegister}
                            className="text-[10px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
                        >
                            create account
                        </button>
                    </div>
                </motion.div>
            </section>

            {/* ─── Footer ──────────────────────────── */}
            <footer className="py-10 flex justify-center">
                <p className="text-[9px] tracking-[0.3em] uppercase text-white/25">
                    all connections temporary
                </p>
            </footer>
        </div>
    )
}
