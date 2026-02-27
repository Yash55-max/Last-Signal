package com.example.lastsignal.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit) {
    var isLoading by remember { mutableStateOf(false) }
    val auth = Firebase.auth

    LaunchedEffect(Unit) {
        if (auth.currentUser != null) {
            onLoginSuccess()
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = "Welcome to Last Signal", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(32.dp))
        
        if (isLoading) {
            CircularProgressIndicator()
        } else {
            Button(onClick = {
                isLoading = true
                // In a real app, implement Google Sign-In. 
                // For MVP/Demo, we'll use Anonymous Sign-In to show flow.
                auth.signInAnonymously().addOnCompleteListener { task ->
                    isLoading = false
                    if (task.isSuccessful) {
                        onLoginSuccess()
                    }
                }
            }) {
                Text("Enter Anonymously")
            }
        }
    }
}
