package com.example.lastsignal.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.lastsignal.monitor.DeviceStateMonitor
import com.example.lastsignal.ui.theme.LastSignalTheme

@Composable
fun MainScreen(
    onEnterChat: (String, String) -> Unit = { _, _ -> }
) {
    val context = LocalContext.current
    val monitor = remember { DeviceStateMonitor(context) }
    val batteryLevel by monitor.batteryLevel.collectAsState()
    val isMidnightMode by monitor.isMidnightMode.collectAsState()

    var showMessageInput by remember { mutableStateOf(false) }
    var initialMessage by remember { mutableStateOf("") }
    var selectedMode by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            monitor.updateBatteryLevel()
            monitor.updateMidnightMode()
            kotlinx.coroutines.delay(10000)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = "Last Signal", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(32.dp))
        
        Text(text = "Battery Level: $batteryLevel%")
        
        Spacer(modifier = Modifier.height(16.dp))

        if (isSearching) {
            CircularProgressIndicator()
            Spacer(modifier = Modifier.height(8.dp))
            Text("Finding a match based on your signal...")
        } else if (showMessageInput) {
            TextField(
                value = initialMessage,
                onValueChange = { initialMessage = it },
                label = { Text("Enter your first signal...") },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = { 
                    if (initialMessage.isNotBlank()) {
                        isSearching = true
                    }
                },
                enabled = initialMessage.isNotBlank()
            ) {
                Text("Search for Connection")
            }
            TextButton(onClick = { showMessageInput = false }) {
                Text("Cancel")
            }
        } else {
            if (batteryLevel <= 7) {
                Button(onClick = { 
                    selectedMode = "low_battery"
                    showMessageInput = true 
                }) {
                    Text("Enter Low Battery Mode")
                }
            } else if (isMidnightMode) {
                Button(onClick = { 
                    selectedMode = "midnight"
                    showMessageInput = true 
                }) {
                    Text("Enter Midnight Mode")
                }
            } else {
                Text(text = "Waiting for triggers...")
                Text(text = "(Low battery < 7% or Midnight 12AM-2AM)")
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
        Button(onClick = { /* Logout */ }) {
            Text("Logout")
        }
    }
}

@Preview(showBackground = true)
@Composable
fun MainScreenPreview() {
    LastSignalTheme {
        MainScreen()
    }
}
