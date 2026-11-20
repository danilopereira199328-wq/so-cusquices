import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';

const FollowContext = createContext();

export function FollowProvider({ children }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFollowing([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const followDocRef = doc(db, 'follows', user.uid);

    const unsubscribe = onSnapshot(
      followDocRef,
      (snap) => {
        if (snap.exists()) {
          setFollowing(snap.data().following || []);
        } else {
          setFollowing([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao ouvir follows:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const toggleFollow = useCallback(
    async (targetUserId) => {
      if (!user || !targetUserId || user.uid === targetUserId) return;

      const isCurrentlyFollowing = following.includes(targetUserId);
      const followRef = doc(db, 'follows', user.uid);
      const currentUserRef = doc(db, 'users', user.uid);
      const targetUserRef = doc(db, 'users', targetUserId);
      const delta = isCurrentlyFollowing ? -1 : 1;

      try {
        await setDoc(
          followRef,
          {
            following: isCurrentlyFollowing
              ? arrayRemove(targetUserId)
              : arrayUnion(targetUserId),
          },
          { merge: true }
        );

        await setDoc(
          currentUserRef,
          {
            displayName: user.displayName || 'Utilizador',
            followingCount: increment(delta),
          },
          { merge: true }
        );

        await setDoc(
          targetUserRef,
          {
            followersCount: increment(delta),
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Erro ao alternar follow:', error);
        throw error;
      }
    },
    [user, following]
  );

  const isFollowing = useCallback(
    (targetUserId) => following.includes(targetUserId),
    [following]
  );

  return (
    <FollowContext.Provider
      value={{
        following,
        loading,
        toggleFollow,
        isFollowing,
      }}
    >
      {children}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  return useContext(FollowContext);
}