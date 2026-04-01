import { useState } from "react"
import { useBattery } from "../hooks/useBattery"

export function useLowSignal() {
    const battery = useBattery()
    const [manualMode, setManualMode] = useState(false)

    // Low signal visual effect when battery ≤ 10% (charging state does not bypass low signal)
    const isAutoLowSignal = battery.supported && battery.level <= 10

    const isLowSignal = isAutoLowSignal || manualMode

    return {
        isLowSignal,
        manualMode,
        setManualMode,
        battery
    }
}
