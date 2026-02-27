package com.example.lastsignal.data.model

import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class User(
    val userId: String = "",
    @ServerTimestamp val createdAt: Date? = null,
    @ServerTimestamp val lastActive: Date? = null,
    val deviceState: String = ""
)

data class MatchingRequest(
    val userId: String = "",
    val sentiment: String = "neutral",
    val mode: String = "",
    @ServerTimestamp val timestamp: Date? = null,
    val initialMessage: String = ""
)

data class ActiveSession(
    val sessionId: String = "",
    val user1: String = "",
    val user2: String = "",
    val mode: String = "",
    @ServerTimestamp val startTime: Date? = null,
    val endTime: Long = 0,
    val status: String = "active"
)

data class Message(
    val senderId: String = "",
    val text: String = "",
    @ServerTimestamp val timestamp: Date? = null
)
