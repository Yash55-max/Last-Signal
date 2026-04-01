import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { WifiOff } from "lucide-react"
import { jsPDF } from "jspdf"
import { getSignalModeConfig, normalizeSignalMode } from "../lib/signalModes"
import { cn } from "../lib/utils"

function formatDuration(ms) {
    if (!ms) return null
    const totalSeconds = Math.max(0, Math.round(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function formatChatTimestamp(timestamp) {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function wrapCanvasText(context, text, maxWidth) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean)
    if (!words.length) return ['']

    const lines = []
    let current = words[0]

    for (let index = 1; index < words.length; index += 1) {
        const candidate = `${current} ${words[index]}`
        if (context.measureText(candidate).width <= maxWidth) {
            current = candidate
            continue
        }

        lines.push(current)
        current = words[index]
    }

    lines.push(current)
    return lines
}

function shouldUsePdfExport(chatTranscript) {
    const messageCount = chatTranscript.length
    const totalChars = chatTranscript.reduce((sum, entry) => sum + String(entry?.text || '').length, 0)
    return messageCount >= 35 || totalChars >= 6000
}

function createPagedPdfFromCanvas(canvas) {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 24
    const usableWidth = pageWidth - (margin * 2)
    const usableHeight = pageHeight - (margin * 2)

    const scaledFullHeight = (canvas.height * usableWidth) / canvas.width
    if (scaledFullHeight <= usableHeight) {
        const image = canvas.toDataURL('image/png')
        pdf.addImage(image, 'PNG', margin, margin, usableWidth, scaledFullHeight, undefined, 'FAST')
        return pdf
    }

    const sourceSliceHeight = Math.max(1, Math.floor((usableHeight * canvas.width) / usableWidth))
    const sliceCanvas = document.createElement('canvas')
    const sliceContext = sliceCanvas.getContext('2d')
    if (!sliceContext) {
        const image = canvas.toDataURL('image/png')
        pdf.addImage(image, 'PNG', margin, margin, usableWidth, scaledFullHeight, undefined, 'FAST')
        return pdf
    }

    sliceCanvas.width = canvas.width

    let offsetY = 0
    let pageIndex = 0
    while (offsetY < canvas.height) {
        const currentSliceHeight = Math.min(sourceSliceHeight, canvas.height - offsetY)
        sliceCanvas.height = currentSliceHeight
        sliceContext.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        sliceContext.drawImage(
            canvas,
            0,
            offsetY,
            canvas.width,
            currentSliceHeight,
            0,
            0,
            sliceCanvas.width,
            currentSliceHeight
        )

        const sliceImage = sliceCanvas.toDataURL('image/png')
        const renderedSliceHeight = (currentSliceHeight * usableWidth) / canvas.width
        if (pageIndex > 0) {
            pdf.addPage()
        }
        pdf.addImage(sliceImage, 'PNG', margin, margin, usableWidth, renderedSliceHeight, undefined, 'FAST')

        offsetY += currentSliceHeight
        pageIndex += 1
    }

    return pdf
}

export default function Disconnect({ onReturn, onLogout, username, userEmail, summary }) {
    const mode = getSignalModeConfig(normalizeSignalMode(summary?.signalMode))
    const waitTime = formatDuration(summary?.matchedInMs)
    const duration = formatDuration(summary?.durationMs)
    const [fallbackTimestamp] = useState(() => Date.now())
    const [showMemoryCard, setShowMemoryCard] = useState(false)
    const [shareState, setShareState] = useState(null)
    const canvasRef = useRef(null)
    const chatCanvasRef = useRef(null)
    const shareStateTimeoutRef = useRef(null)
    const memoryTimestamp = useMemo(() => new Date(summary?.endedAt || fallbackTimestamp).toLocaleString(), [fallbackTimestamp, summary?.endedAt])
    const chatTranscript = useMemo(() => Array.isArray(summary?.chatTranscript) ? summary.chatTranscript : [], [summary])
    const memoryLineA = summary?.reason === 'partner_left'
        ? 'the other signal slipped back into static'
        : mode.id === 'battery'
            ? 'low power. loud feelings. short window.'
            : 'night held two voices for a moment'
    const memoryLineB = mode.id === 'battery'
        ? 'captured before the battery gave out'
        : 'captured while the airwaves stayed open'
    const heading = summary?.reason === 'partner_left' ? 'connection lost' : mode.disconnectTitle
    const body = summary?.reason === 'partner_left'
        ? 'the other signal slipped back into the static'
        : mode.disconnectBody

    useEffect(() => {
        if (!showMemoryCard || !canvasRef.current) return

        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = 1080
        canvas.height = 1440

        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
        gradient.addColorStop(0, '#05070f')
        gradient.addColorStop(0.55, mode.id === 'battery' ? '#2b1908' : '#08111f')
        gradient.addColorStop(1, '#030304')

        context.fillStyle = gradient
        context.fillRect(0, 0, canvas.width, canvas.height)

        context.fillStyle = mode.id === 'battery' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(59, 130, 246, 0.14)'
        context.fillRect(96, 120, canvas.width - 192, canvas.height - 240)

        context.fillStyle = 'rgba(255, 255, 255, 0.82)'
        context.font = '300 58px "Segoe UI", sans-serif'
        context.textAlign = 'center'
        context.fillText('LAST SIGNAL MEMORY', canvas.width / 2, 280)

        context.fillStyle = mode.id === 'battery' ? 'rgba(251, 191, 36, 0.9)' : 'rgba(96, 165, 250, 0.9)'
        context.font = '500 30px "Segoe UI", sans-serif'
        context.fillText(mode.label.toUpperCase(), canvas.width / 2, 348)

        context.fillStyle = 'rgba(255, 255, 255, 0.86)'
        context.font = '400 40px "Segoe UI", sans-serif'
        context.fillText(memoryLineA.toUpperCase(), canvas.width / 2, 580)
        context.fillText(memoryLineB.toUpperCase(), canvas.width / 2, 650)

        context.fillStyle = 'rgba(255, 255, 255, 0.55)'
        context.font = '300 28px "Segoe UI", sans-serif'
        context.fillText(`signal name: ${(username || 'anonymous').toUpperCase()}`, canvas.width / 2, 930)
        context.fillText(`time captured: ${memoryTimestamp.toUpperCase()}`, canvas.width / 2, 980)
        context.fillText(`channel held: ${duration || '0m 00s'}`, canvas.width / 2, 1030)
        context.fillText(`messages exchanged: ${summary?.messagesCount || 0}`, canvas.width / 2, 1080)

        context.fillStyle = 'rgba(255, 255, 255, 0.35)'
        context.font = '300 24px "Segoe UI", sans-serif'
        context.fillText('screenshot or download this card to keep it', canvas.width / 2, 1270)
    }, [duration, memoryLineA, memoryLineB, memoryTimestamp, mode.id, mode.label, showMemoryCard, summary?.messagesCount, username])

    useEffect(() => {
        return () => {
            if (shareStateTimeoutRef.current) {
                clearTimeout(shareStateTimeoutRef.current)
                shareStateTimeoutRef.current = null
            }
        }
    }, [])

    const pushShareState = useCallback((nextState) => {
        setShareState(nextState)
        if (shareStateTimeoutRef.current) {
            clearTimeout(shareStateTimeoutRef.current)
            shareStateTimeoutRef.current = null
        }

        shareStateTimeoutRef.current = setTimeout(() => {
            shareStateTimeoutRef.current = null
            setShareState(null)
        }, 2600)
    }, [])

    const renderChatScreenshot = useCallback(() => {
        const canvas = chatCanvasRef.current
        if (!canvas) return false

        const context = canvas.getContext('2d')
        if (!context) return false

        const channelName = mode.id === 'battery' ? 'LOW BATTERY CHANNEL' : 'MIDNIGHT CHANNEL'
        const baseWidth = 1080
        const horizontalPadding = 70
        const bubbleMaxWidth = 630
        const bubbleTextWidth = 540
        const lineHeight = 42
        const bubblePaddingX = 26
        const bubblePaddingY = 20
        const blockGap = 32

        canvas.width = baseWidth
        canvas.height = 1600

        context.font = '400 34px "Segoe UI", sans-serif'

        const blocks = chatTranscript.map((entry, index) => {
            const lines = wrapCanvasText(context, entry.text || '', bubbleTextWidth)
            const measuredLineWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, context.measureText(line).width), 0)
            const width = Math.min(bubbleMaxWidth, Math.max(220, measuredLineWidth + (bubblePaddingX * 2)))
            const height = (lines.length * lineHeight) + (bubblePaddingY * 2)

            return {
                id: entry.id || `${index}`,
                sender: entry.sender === 'you' ? 'you' : 'other',
                senderLabel: entry.senderLabel || (entry.sender === 'you' ? 'YOU' : 'OTHER'),
                timestamp: entry.timestamp || null,
                batteryPercent: Number.isFinite(entry.batteryPercent) ? entry.batteryPercent : null,
                lines,
                width,
                height,
            }
        })

        const transcriptHeight = blocks.reduce((total, block) => total + 20 + block.height + blockGap, 0)
        const headerHeight = 270
        const footerHeight = 180
        canvas.height = Math.max(1440, headerHeight + transcriptHeight + footerHeight)

        const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
        gradient.addColorStop(0, '#05070f')
        gradient.addColorStop(0.55, mode.id === 'battery' ? '#2b1908' : '#08111f')
        gradient.addColorStop(1, '#030304')
        context.fillStyle = gradient
        context.fillRect(0, 0, canvas.width, canvas.height)

        context.fillStyle = mode.id === 'battery' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(96, 165, 250, 0.1)'
        context.fillRect(34, 34, canvas.width - 68, canvas.height - 68)

        context.textAlign = 'center'
        context.fillStyle = 'rgba(255, 255, 255, 0.86)'
        context.font = '300 56px "Segoe UI", sans-serif'
        context.fillText('LAST SIGNAL CHAT', canvas.width / 2, 118)

        context.fillStyle = mode.id === 'battery' ? 'rgba(251, 191, 36, 0.9)' : 'rgba(96, 165, 250, 0.9)'
        context.font = '500 26px "Segoe UI", sans-serif'
        context.fillText(channelName, canvas.width / 2, 168)

        context.fillStyle = 'rgba(255, 255, 255, 0.45)'
        context.font = '300 24px "Segoe UI", sans-serif'
        context.fillText(`captured ${memoryTimestamp.toLowerCase()}`, canvas.width / 2, 214)

        if (!blocks.length) {
            context.fillStyle = 'rgba(255, 255, 255, 0.52)'
            context.font = '300 34px "Segoe UI", sans-serif'
            context.fillText('NO CHAT MESSAGES WERE RECORDED', canvas.width / 2, canvas.height / 2)
            return true
        }

        context.textAlign = 'left'
        let cursorY = headerHeight

        blocks.forEach((block) => {
            const isSelf = block.sender === 'you'
            const x = isSelf ? canvas.width - horizontalPadding - block.width : horizontalPadding

            context.fillStyle = 'rgba(255, 255, 255, 0.34)'
            context.font = '300 20px "Segoe UI", sans-serif'
            const details = [`${block.senderLabel.toUpperCase()}`, formatChatTimestamp(block.timestamp)]
            if (mode.id === 'battery' && Number.isFinite(block.batteryPercent)) {
                details.push(`${Math.round(block.batteryPercent)}%`)
            }
            const metadata = details.join('  •  ')
            const labelWidth = context.measureText(metadata).width
            const labelX = isSelf ? (x + block.width - labelWidth) : x
            context.fillText(metadata, labelX, cursorY)

            cursorY += 20

            context.fillStyle = isSelf
                ? (mode.id === 'battery' ? 'rgba(251, 191, 36, 0.22)' : 'rgba(96, 165, 250, 0.2)')
                : 'rgba(255, 255, 255, 0.08)'
            context.beginPath()
            context.roundRect(x, cursorY, block.width, block.height, 28)
            context.fill()

            context.fillStyle = 'rgba(255, 255, 255, 0.92)'
            context.font = '400 34px "Segoe UI", sans-serif'
            block.lines.forEach((line, lineIndex) => {
                context.fillText(line, x + bubblePaddingX, cursorY + bubblePaddingY + 31 + (lineIndex * lineHeight))
            })

            cursorY += block.height + blockGap
        })

        context.textAlign = 'center'
        context.fillStyle = 'rgba(255, 255, 255, 0.32)'
        context.font = '300 22px "Segoe UI", sans-serif'
        context.fillText('ALL CONNECTIONS TEMPORARY', canvas.width / 2, canvas.height - 64)

        return true
    }, [chatTranscript, memoryTimestamp, mode.id])

    const handleDownloadMemory = () => {
        if (!canvasRef.current) return

        const link = document.createElement('a')
        link.download = `last-signal-memory-${Date.now()}.png`
        link.href = canvasRef.current.toDataURL('image/png')
        link.click()
    }

    const handleShareChat = useCallback(async () => {
        if (!chatTranscript.length) {
            pushShareState('no messages to share')
            return
        }

        const exportAsPdf = shouldUsePdfExport(chatTranscript)

        const rendered = renderChatScreenshot()
        if (!rendered || !chatCanvasRef.current) {
            pushShareState('share failed')
            return
        }

        if (exportAsPdf) {
            try {
                const filename = `last-signal-chat-${Date.now()}.pdf`
                const pdf = createPagedPdfFromCanvas(chatCanvasRef.current)
                const pdfBlob = pdf.output('blob')
                const pdfFile = typeof File === 'function' ? new File([pdfBlob], filename, { type: 'application/pdf' }) : null
                const canUseNativeShare = Boolean(
                    pdfFile &&
                    typeof navigator !== 'undefined' &&
                    typeof navigator.share === 'function' &&
                    (!navigator.canShare || navigator.canShare({ files: [pdfFile] }))
                )

                if (canUseNativeShare) {
                    try {
                        await navigator.share({
                            title: 'Last Signal Chat',
                            text: mode.id === 'battery' ? 'Low battery chat export' : 'Midnight chat export',
                            files: [pdfFile],
                        })
                        pushShareState('shared as pdf')
                        return
                    } catch (error) {
                        if (error?.name === 'AbortError') {
                            return
                        }
                    }
                }

                const url = URL.createObjectURL(pdfBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = filename
                link.click()
                URL.revokeObjectURL(url)
                pushShareState('downloaded pdf')
                return
            } catch {
                pushShareState('pdf export failed')
                return
            }
        }

        const blob = await new Promise((resolve) => {
            chatCanvasRef.current.toBlob(resolve, 'image/png')
        })

        if (!blob) {
            pushShareState('share failed')
            return
        }

        const filename = `last-signal-chat-${Date.now()}.png`
        const file = typeof File === 'function' ? new File([blob], filename, { type: 'image/png' }) : null
        const canUseNativeShare = Boolean(
            file &&
            typeof navigator !== 'undefined' &&
            typeof navigator.share === 'function' &&
            (!navigator.canShare || navigator.canShare({ files: [file] }))
        )

        if (canUseNativeShare) {
            try {
                await navigator.share({
                    title: 'Last Signal Chat',
                    text: mode.id === 'battery' ? 'Low battery chat capture' : 'Midnight chat capture',
                    files: [file],
                })
                pushShareState('shared')
                return
            } catch (error) {
                if (error?.name === 'AbortError') {
                    return
                }
            }
        }

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
        pushShareState('downloaded screenshot')
    }, [chatTranscript, mode.id, pushShareState, renderChatScreenshot])

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
            {showMemoryCard && (
                <div className="fixed inset-0 z-30 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 px-6 py-10">
                    <div className="text-[10px] tracking-[0.34em] uppercase text-white/45">memory card ready</div>
                    <canvas ref={canvasRef} className="w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl" />
                    <div className="flex flex-col gap-3 mt-2">
                        <button onClick={handleDownloadMemory} className="btn-signal">[ download memory ]</button>
                        <button onClick={() => onReturn('keep')} className="text-[10px] tracking-[0.3em] uppercase text-white/55 hover:text-white/85 transition-colors">[ return to landing ]</button>
                    </div>
                </div>
            )}

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed top-12 left-0 right-0 flex justify-between items-center px-8 z-10"
            >
                <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[9px] tracking-[0.3em] uppercase text-white/60">{username}</span>
                    {userEmail && <span className="text-[8px] tracking-[0.15em] text-white/30 lowercase">{userEmail}</span>}
                </div>
                <button
                    onClick={onLogout}
                    className="text-[9px] tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
                >
                    disconnect
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
                className="mb-8 text-white/25"
            >
                <WifiOff size={48} strokeWidth={1} />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="space-y-4"
            >
                <div className={cn("text-[9px] tracking-[0.35em] uppercase", mode.accentText)}>{mode.iconLabel}</div>
                <h2 className="text-3xl font-light tracking-[0.2em] uppercase">
                    {heading}
                </h2>
                <p className="text-white/70 text-sm tracking-widest font-light py-2">
                    {body}
                </p>
                {(waitTime || duration) && (
                    <div className="text-[9px] tracking-[0.2em] uppercase text-white/30 flex flex-col gap-2 pt-3">
                        {waitTime && <span>found a signal in {waitTime}</span>}
                        {duration && <span>held the channel for {duration}</span>}
                    </div>
                )}
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="mt-12 flex flex-col gap-4"
            >
                <button
                    onClick={() => setShowMemoryCard(true)}
                    className="btn-signal"
                >
                    [ keep the memory ]
                </button>
                <button
                    onClick={handleShareChat}
                    className="text-[10px] tracking-[0.28em] uppercase text-white/58 hover:text-white/88 transition-colors"
                >
                    [ share chat screenshot ]
                </button>
                {shareState && (
                    <div className="text-[8px] tracking-[0.24em] uppercase text-white/40">
                        {shareState}
                    </div>
                )}
                <button
                    onClick={() => onReturn('fade')}
                    className="text-[10px] tracking-[0.32em] uppercase text-white/45 hover:text-white/80 transition-colors"
                >
                    [ let it fade ]
                </button>
            </motion.div>

            <canvas ref={chatCanvasRef} className="hidden" aria-hidden="true" />

            <footer className="fixed bottom-12 left-0 right-0 text-[10px] uppercase tracking-[0.3em] text-white/30">
                all connections temporary
            </footer>
        </div>
    )
}
