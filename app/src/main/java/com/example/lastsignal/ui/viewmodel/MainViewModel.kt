package com.example.lastsignal.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.lastsignal.data.model.MatchingRequest
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MainViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<MainUiState>(MainUiState.Idle)
    val uiState: StateFlow<MainUiState> = _uiState

    private val db = Firebase.firestore
    private val auth = Firebase.auth

    fun startMatching(mode: String, initialMessage: String) {
        viewModelScope.launch {
            _uiState.value = MainUiState.Matching
            val userId = auth.currentUser?.uid ?: return@launch
            
            val request = MatchingRequest(
                userId = userId,
                mode = mode,
                initialMessage = initialMessage,
                sentiment = "neutral" // Placeholder: Cloud Function will update this
            )

            try {
                // Add to matching queue
                db.collection("matching_queue").document(userId).set(request).await()
                
                // Listen for session assignment
                db.collection("active_sessions")
                    .whereArrayContainsAny("users", listOf(userId))
                    .whereEqualTo("status", "active")
                    .addSnapshotListener { snapshot, _ ->
                        val doc = snapshot?.documents?.firstOrNull()
                        if (doc != null) {
                            _uiState.value = MainUiState.Matched(doc.id, mode)
                        }
                    }
            } catch (e: Exception) {
                _uiState.value = MainUiState.Error(e.message ?: "Matching failed")
            }
        }
    }
}

sealed class MainUiState {
    object Idle : MainUiState()
    object Matching : MainUiState()
    data class Matched(val sessionId: String, val mode: String) : MainUiState()
    data class Error(val message: String) : MainUiState()
}
