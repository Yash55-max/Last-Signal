package com.example.lastsignal.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.lastsignal.data.model.Message
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.delay

@Composable
fun ChatScreen(sessionId: String, mode: String, onChatEnd: () -> Unit) {
    val db = Firebase.firestore
    val auth = Firebase.auth
    var messages by remember { mutableStateOf(emptyList<Message>()) }
    var inputText by remember { mutableStateOf("") }
    var timeLeft by remember { mutableStateOf(if (mode == "low_battery") 60 else 180) }

    LaunchedEffect(sessionId) {
        val docRef = db.collection("active_sessions").document(sessionId)
        val registration = docRef.collection("messages")
            .orderBy("timestamp", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener
                if (snapshot != null) {
                    messages = snapshot.toObjects(Message::class.java)
                }
            }
        
        // Timer logic
        while (timeLeft > 0) {
            delay(1000)
            timeLeft--
        }
        onChatEnd()
        registration.remove()
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "Mode: ${mode.replace("_", " ").uppercase()}", style = MaterialTheme.typography.labelLarge)
            Text(text = "Time Left: ${timeLeft}s", color = MaterialTheme.colorScheme.error)
        }

        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            reverseLayout = false
        ) {
            items(messages) { message ->
                val isMe = message.senderId == auth.currentUser?.uid
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = if (isMe) Alignment.End else Alignment.Start
                ) {
                    Surface(
                        color = if (isMe) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.secondaryContainer,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.padding(4.dp)
                    ) {
                        Text(text = message.text, modifier = Modifier.padding(8.dp))
                    }
                }
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            TextField(
                value = inputText,
                onValueChange = { inputText = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Say something...") }
            )
            Button(onClick = {
                if (inputText.isNotBlank()) {
                    val msg = Message(auth.currentUser?.uid ?: "unknown", inputText, null)
                    db.collection("active_sessions").document(sessionId).collection("messages").add(msg)
                    inputText = ""
                }
            }) {
                Text("Send")
            }
        }
    }
}
