import { useState, useEffect } from "react"

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const [isInstalled, setIsInstalled] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone
    })
    const [isIOS] = useState(() => {
        if (typeof window === 'undefined') return false
        const ua = window.navigator.userAgent
        return /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    })

    useEffect(() => {
        if (isInstalled) return

        const handleBeforeInstall = (e) => {
            e.preventDefault()
            setDeferredPrompt(e)
        }

        const handleAppInstalled = () => {
            setIsInstalled(true)
            setDeferredPrompt(null)
        }

        window.addEventListener("beforeinstallprompt", handleBeforeInstall)
        window.addEventListener("appinstalled", handleAppInstalled)

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
            window.removeEventListener("appinstalled", handleAppInstalled)
        }
    }, [isInstalled])

    const install = async () => {
        if (!deferredPrompt) return false
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        setDeferredPrompt(null)
        if (outcome === "accepted") {
            setIsInstalled(true)
            return true
        }
        return false
    }

    const canInstall = (!isInstalled && !!deferredPrompt) || (!isInstalled && isIOS)

    return { canInstall, isInstalled, isIOS, install }
}
