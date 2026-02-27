const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/**
 * Triggered when a new user enters the matching queue.
 */
exports.matchUser = functions.firestore
    .document("matching_queue/{userId}")
    .onCreate(async (snap, context) => {
        const newUser = snap.data();
        const userId = context.params.userId;
        const mode = newUser.mode;
        const initialMessage = newUser.initialMessage;

        // 1. Placeholder for Sentiment Analysis (ML Classifier)
        // In a full implementation, you'd call a model here.
        const sentiment = analyzeSentiment(initialMessage);
        console.log(`User ${userId} entered ${mode} queue with sentiment: ${sentiment}`);

        // 2. Find a match based on mode
        let matchQuery = db.collection("matching_queue")
            .where("mode", "==", mode)
            .where("userId", "!=", userId)
            .orderBy("userId") // Required for != query
            .orderBy("timestamp", "asc")
            .limit(1);

        const snapshot = await matchQuery.get();

        if (snapshot.empty) {
            console.log("No match found yet. Waiting in queue...");
            return null;
        }

        const matchedUserDoc = snapshot.docs[0];
        const matchedUserId = matchedUserDoc.id;
        const matchedUserData = matchedUserDoc.data();

        // 3. Check for compatibility (Low Battery: Complementary, Midnight: Similar)
        const isCompatible = checkCompatibility(mode, sentiment, matchedUserData.sentiment);

        if (!isCompatible) {
            console.log("Found user but sentiment not compatible. Waiting...");
            return null;
        }

        // 4. Create an Active Session
        const sessionId = `${userId}_${matchedUserId}_${Date.now()}`;
        const sessionRef = db.collection("active_sessions").document(sessionId);

        const batch = db.batch();
        batch.set(sessionRef, {
            users: [userId, matchedUserId],
            mode: mode,
            startTime: admin.firestore.FieldValue.serverTimestamp(),
            status: "active",
            endTime: mode === "low_battery" ? Date.now() + 60000 : Date.now() + 180000
        });

        // 5. Remove both users from the queue
        batch.delete(db.collection("matching_queue").document(userId));
        batch.delete(db.collection("matching_queue").document(matchedUserId));

        await batch.commit();
        console.log(`Match found! Session ${sessionId} created.`);
        return null;
    });

function analyzeSentiment(text) {
    // Simple mock logic for MVP
    const positiveWords = ["happy", "good", "great", "love", "excited"];
    const negativeWords = ["sad", "bad", "angry", "lonely", "tired"];

    const lowerText = text.toLowerCase();
    if (positiveWords.some(word => lowerText.includes(word))) return "positive";
    if (negativeWords.some(word => lowerText.includes(word))) return "negative";
    return "neutral";
}

function checkCompatibility(mode, s1, s2) {
    if (mode === "low_battery") {
        // Complementary: positive matches negative, neutral matches neutral
        if (s1 === "positive" && s2 === "negative") return true;
        if (s1 === "negative" && s2 === "positive") return true;
        if (s1 === "neutral" && s2 === "neutral") return true;
        return false;
    } else {
        // Midnight: Similar sentiment
        return s1 === s2;
    }
}
