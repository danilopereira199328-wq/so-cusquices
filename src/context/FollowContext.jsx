import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const FollowContext = createContext();

export function FollowProvider({ children }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    if (!user) return;
    const fetchFollowing = async () => {
      const docRef = doc(db, 'follows', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFollowing(docSnap.data().following || []);
      }
    };
    fetchFollowing();
  }, [user]);

  const toggleFollow = async (targetUid) => {
    if (!user) return;
    const userRef = doc(db, 'follows', user.uid);
    const isFollowing = following.includes(targetUid);

    try {
      if (isFollowing) {
        await updateDoc(userRef, { following: arrayRemove(targetUid) });
        setFollowing(prev => prev.filter(id => id !== targetUid));
      } else {
        await setDoc(userRef, { following: arrayUnion(targetUid) }, { merge: true });
        setFollowing(prev => [...prev, targetUid]);
      }
    } catch (error) {
      console.error("Erro ao seguir:", error);
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