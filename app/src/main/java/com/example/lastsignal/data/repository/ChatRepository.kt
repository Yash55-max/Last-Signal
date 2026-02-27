package com.example.lastsignal.data.repository

import com.example.lastsignal.data.model.Message
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class ChatRepository(private val db: FirebaseFirestore) {

    fun getMessages(sessionId: String): Flow<List<Message>> = callbackFlow {
        val subscription = db.collection("active_sessions")
            .document(sessionId)
            .collection("messages")
            .orderBy("timestamp", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, _ ->
                if (snapshot != null) {
                    trySend(snapshot.toObjects(Message::class.java))
                }
            }
        awaitClose { subscription.remove() }
    }

    fun sendMessage(sessionId: String, message: Message) {
        db.collection("active_sessions")
            .document(sessionId)
            .collection("messages")
            .add(message)
    }
}
