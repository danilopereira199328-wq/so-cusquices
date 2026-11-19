import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const FollowContext = createContext();

export function FollowProvider({ children }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    if (!user) {
      setFollowing([]);
      return;
    }
    const docRef = doc(db, 'follows', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setFollowing(docSnap.data().following || []);
      } else {
        setFollowing([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const toggleFollow = async (targetUid) => {
    if (!user || user.uid === targetUid) return;
    const userRef = doc(db, 'follows', user.uid);
    const currentlyFollowing = following.includes(targetUid);

    try {
      await setDoc(
        userRef,
        {
          following: currentlyFollowing
            ? arrayRemove(targetUid)
            : arrayUnion(targetUid),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Erro ao atualizar follow:', error);
    }
  };

  const isFollowing = (targetUid) => following.includes(targetUid);

  return (
    <FollowContext.Provider value={{ following, toggleFollow, isFollowing }}>
      {children}
    </FollowContext.Provider>
  );
}

export const useFollow = () => useContext(FollowContext);