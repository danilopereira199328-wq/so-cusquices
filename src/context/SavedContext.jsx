import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const SavedContext = createContext();

export function SavedProvider({ children }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    if (!user) return;
    const fetchSaved = async () => {
      const docRef = doc(db, 'saved', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSaved(docSnap.data().posts || []);
      }
    };
    fetchSaved();
  }, [user]);

  const toggleSave = async (postId) => {
    if (!user) return;
    const userRef = doc(db, 'saved', user.uid);
    const isSaved = saved.includes(postId);

    try {
      if (isSaved) {
        await updateDoc(userRef, { posts: arrayRemove(postId) });
        setSaved(prev => prev.filter(id => id !== postId));
      } else {
        await setDoc(userRef, { posts: arrayUnion(postId) }, { merge: true });
        setSaved(prev => [...prev, postId]);
      }
    } catch (error) {
      console.error("Erro ao guardar:", error);
    }
  };

  const isSaved = (postId) => saved.includes(postId);

  return (
    <SavedContext.Provider value={{ saved, toggleSave, isSaved }}>
      {children}
    </SavedContext.Provider>
  );
}

export const useSaved = () => useContext(SavedContext);