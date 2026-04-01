import { useState, useEffect } from 'react'

export function useBattery() {
    const [battery, setBattery] = useState({ level: 100, charging: true, supported: false })

    useEffect(() => {
        if (!navigator.getBattery) {
            return
        }

        // Keep a ref to the cleanup so React can actually call it on unmount.
        // Previously the cleanup was returned inside .then(), which React never receives.
        let cleanup = null

        navigator.getBattery().then(bat => {
            const updateBattery = () => {
                setBattery({
                    level: Math.round(bat.level * 100),
                    charging: bat.charging,
                    supported: true
                })
            }
            updateBattery()
            bat.addEventListener('levelchange', updateBattery)
            bat.addEventListener('chargingchange', updateBattery)
            cleanup = () => {
                bat.removeEventListener('levelchange', updateBattery)
                bat.removeEventListener('chargingchange', updateBattery)
            }
        })

        return () => cleanup?.()
    }, [])

    return battery
}
