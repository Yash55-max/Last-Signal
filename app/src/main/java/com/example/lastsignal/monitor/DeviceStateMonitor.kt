package com.example.lastsignal.monitor

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.time.LocalTime

class DeviceStateMonitor(private val context: Context) {

    private val _batteryLevel = MutableStateFlow(100)
    val batteryLevel: StateFlow<Int> = _batteryLevel

    private val _isMidnightMode = MutableStateFlow(false)
    val isMidnightMode: StateFlow<Boolean> = _isMidnightMode

    fun updateBatteryLevel() {
        val batteryStatus: Intent? = IntentFilter(Intent.ACTION_BATTERY_CHANGED).let { ifilter ->
            context.registerReceiver(null, ifilter)
        }
        val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        _batteryLevel.value = (level * 100 / scale.toFloat()).toInt()
    }

    fun updateMidnightMode() {
        val now = LocalTime.now()
        _isMidnightMode.value = now.hour == 0 || (now.hour == 1) || (now.hour == 2 && now.minute == 0)
    }
}
