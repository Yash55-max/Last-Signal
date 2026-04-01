import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  limit,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { enqueueOrMatchUser, normalizeMatchmakerData, removeUserFromQueues } from "./matchmakerState";
import { DEFAULT_SIGNAL_MODE, getSessionDuration, normalizeSignalMode } from "./signalModes";

export const HEARTBEAT_INTERVAL_MS = 5000;
export const HEARTBEAT_STALE_AFTER_MS = 10000;
export const HEARTBEAT_TERMINATION_DELAY_MS = 3000;

function isPermissionDenied(error) {
  return error?.code === "permission-denied";
}

// ─── User Profiles ───────────────────────────────────────

export async function saveUsername(uid, username) {
  await setDoc(doc(db, "users", uid), {
    username,
    createdAt: serverTimestamp(),
  });
}

export async function getUsername(uid) {
  const docSnap = await getDoc(doc(db, "users", uid));
  if (docSnap.exists()) {
    return docSnap.data().username;
  }
  return null;
}

export async function isUsernameTaken(username) {
  const q = query(
    collection(db, "users"),
    where("username", "==", username),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

function buildParticipantState(users, connection = "connected") {
  return users.reduce((accumulator, uid) => {
    accumulator[uid] = {
      connection,
      visibility: "visible",
      isTyping: false,
      lastSeenAt: serverTimestamp(),
    };
    return accumulator;
  }, {});
}

// ─── Chat Room ───────────────────────────────────────────

export async function createRoom(user1, user2, mode) {
  const normalizedMode = normalizeSignalMode(mode);
  const duration = getSessionDuration(normalizedMode);
  const users = [user1, user2];

  const roomRef = await addDoc(collection(db, "chatRooms"), {
    users,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + duration),
    mode: normalizedMode,
    participantState: buildParticipantState(users),
    status: "active",
  });
  return roomRef.id;
}

export async function endRoom(roomId) {
  const roomRef = doc(db, "chatRooms", roomId);
  await updateDoc(roomRef, {
    status: "ended",
    endedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  setTimeout(() => deleteRoom(roomId), 3000);
}

export async function leaveChat(roomId) {
  const roomRef = doc(db, "chatRooms", roomId);
  await updateDoc(roomRef, {
    status: "user_left",
    endedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  setTimeout(() => deleteRoom(roomId), 3000);
}

async function deleteRoom(roomId) {
  try {
    const messagesRef = collection(db, "chatRooms", roomId, "messages");
    const msgSnap = await getDocs(messagesRef);
    const deletePromises = msgSnap.docs.map((snapshotDoc) => deleteDoc(snapshotDoc.ref));
    await Promise.all(deletePromises);
    await deleteDoc(doc(db, "chatRooms", roomId));
  } catch {
    // Room may already be gone on the other client.
  }
}

export async function markRoomPresence(roomId, uid, { connection, visibility, isTyping, touchActivity = false } = {}) {
  if (!roomId || !uid || !db) return;

  try {
    const roomRef = doc(db, "chatRooms", roomId);
    const updates = {
      [`participantState.${uid}.lastSeenAt`]: serverTimestamp(),
    };

    if (connection) updates[`participantState.${uid}.connection`] = connection;
    if (visibility) updates[`participantState.${uid}.visibility`] = visibility;
    if (typeof isTyping === "boolean") updates[`participantState.${uid}.isTyping`] = isTyping;
    if (touchActivity) updates.lastActivityAt = serverTimestamp();

    await updateDoc(roomRef, updates);
  } catch (err) {
    if (err.code === 'permission-denied') {
      console.warn(`[Firestore] Presence update denied for room ${roomId}. Room may be closed.`);
    } else {
      console.error("[Firestore] Presence update error:", err);
    }
  }
}

export async function reportIncident(roomId, reporterId, details = {}) {
  if (!roomId || !reporterId) return;

  await addDoc(collection(db, "incidentReports"), {
    roomId,
    reporterId,
    reason: details.reason || "manual_report",
    signalMode: details.signalMode || null,
    createdAt: serverTimestamp(),
  });
}

export function listenRoomStatus(roomId, onStatusChange) {
  const roomRef = doc(db, "chatRooms", roomId);
  return onSnapshot(
    roomRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onStatusChange(data.status, data);
      }
    },
    (error) => {
      if (isPermissionDenied(error)) {
        console.warn(`[Firestore] Status listener denied for room ${roomId}. Room may be closed.`);
        return;
      }
      console.error(`[Firestore] Status listener error for room ${roomId}:`, error);
    }
  );
}

export async function getActiveRoom(uid) {
  try {
    const q = query(
      collection(db, "chatRooms"),
      where("users", "array-contains", uid),
      where("status", "==", "active"),
      limit(5)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const activeRoom = snap.docs.find((roomDoc) => {
      const data = roomDoc.data();
      if (!data.expiresAt) return false;
      const expiresAt = typeof data.expiresAt.toMillis === "function" ? data.expiresAt.toMillis() : data.expiresAt;
      return expiresAt >= Date.now();
    });

    if (!activeRoom) return null;

    const data = activeRoom.data();
    return {
      roomId: activeRoom.id,
      mode: normalizeSignalMode(data.mode),
      createdAt: typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : null,
    };
  } catch (error) {
    if (isPermissionDenied(error)) {
      return null;
    }
    throw error;
  }
}

// ─── Messages (nested subcollection) ────────────────────

export async function sendMessage(roomId, senderId, senderName, text, options = {}) {
  const payload = {
    senderId,
    senderName: senderName || senderId.slice(0, 8),
    text,
    createdAt: serverTimestamp(),
  };

  if (Number.isFinite(options.batteryPercent)) {
    payload.batteryPercent = Math.max(0, Math.min(100, Math.round(options.batteryPercent)));
  }

  await addDoc(collection(db, "chatRooms", roomId, "messages"), payload);

  await updateDoc(doc(db, "chatRooms", roomId), {
    lastActivityAt: serverTimestamp(),
    lastMessageSenderId: senderId,
  });
}

export function listenMessages(roomId, callback) {
  const q = query(
    collection(db, "chatRooms", roomId, "messages"),
    orderBy("createdAt")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));
      callback(messages);
    },
    (error) => {
      if (isPermissionDenied(error)) {
        console.warn(`[Firestore] Messages listener denied for room ${roomId}. Room may be closed.`);
        return;
      }
      console.error(`[Firestore] Messages listener error for room ${roomId}:`, error);
    }
  );
}

// ─── Matchmaking (Single-Document Transaction) ─────────

const MATCH_REF = doc(db, "matchmaker", "global");

export async function findMatch(currentUid, mode) {
  let matchedRoomId = null;
  const normalizedMode = normalizeSignalMode(mode);
  const duration = getSessionDuration(normalizedMode);

  await runTransaction(db, async (transaction) => {
    const matchDoc = await transaction.get(MATCH_REF);
    const currentState = normalizeMatchmakerData(matchDoc.exists() ? matchDoc.data() : {});
    const nextState = enqueueOrMatchUser(currentState, currentUid, normalizedMode);

    transaction.set(
      MATCH_REF,
      {
        queues: nextState.queues,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (nextState.partnerUid) {
      const roomRef = doc(collection(db, "chatRooms"));
      const users = [currentUid, nextState.partnerUid];

      transaction.set(roomRef, {
        users,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + duration),
        mode: normalizedMode,
        participantState: buildParticipantState(users),
        status: "active",
      });

      matchedRoomId = roomRef.id;
    }
  });

  return matchedRoomId;
}

export async function cancelMatch(uid) {
  await runTransaction(db, async (transaction) => {
    const matchDoc = await transaction.get(MATCH_REF);
    const currentState = normalizeMatchmakerData(matchDoc.exists() ? matchDoc.data() : {});
    const nextQueues = removeUserFromQueues(currentState.queues, uid);

    transaction.set(
      MATCH_REF,
      {
        queues: nextQueues,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export function listenForRoomInvite(uid, onMatch) {
  const q = query(
    collection(db, "chatRooms"),
    where("users", "array-contains", uid),
    where("status", "==", "active")
  );

  return onSnapshot(
    q, 
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          onMatch(change.doc.id);
        }
      });
    },
    (error) => {
      if (isPermissionDenied(error)) {
        console.warn("[Firestore] Match listener denied. Check chatRooms rules for list queries.");
        return;
      }
      console.error("[Firestore] Match listener error:", error);
    }
  );
}

export { DEFAULT_SIGNAL_MODE };
