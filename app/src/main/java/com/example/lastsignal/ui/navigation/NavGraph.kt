package com.example.lastsignal.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.lastsignal.ui.screens.MainScreen
import com.example.lastsignal.ui.screens.LoginScreen
import com.example.lastsignal.ui.screens.ChatScreen

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Main : Screen("main")
    object Chat : Screen("chat/{sessionId}/{mode}") {
        fun createRoute(sessionId: String, mode: String) = "chat/$sessionId/$mode"
    }
}

@Composable
fun NavGraph(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(onLoginSuccess = {
                navController.navigate(Screen.Main.route) {
                    popUpTo(Screen.Login.route) { inclusive = true }
                }
            })
        }
        composable(Screen.Main.route) {
            MainScreen(
                onEnterChat = { sessionId, mode ->
                    navController.navigate(Screen.Chat.createRoute(sessionId, mode))
                }
            )
        }
        composable(Screen.Chat.route) { backStackEntry ->
            val sessionId = backStackEntry.arguments?.getString("sessionId") ?: ""
            val mode = backStackEntry.arguments?.getString("mode") ?: ""
            ChatScreen(sessionId = sessionId, mode = mode, onChatEnd = {
                navController.popBackStack(Screen.Main.route, inclusive = false)
            })
        }
    }
}
