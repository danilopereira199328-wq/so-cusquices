import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const SavedContext = createContext();

export function SavedProvider({ children }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSaved([]);
      setLoading(false);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setSaved(snap.data().bookmarks || []);
        } else {
          setSaved([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar guardados:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const toggleSave = async (postId) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const isSaved = saved.includes(postId);

    try {
      await setDoc(
        userRef,
        {
          bookmarks: isSaved ? arrayRemove(postId) : arrayUnion(postId),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Erro ao guardar post:', error);
    }
  };

  const isSaved = (postId) => saved.includes(postId);

  return (
    <SavedContext.Provider value={{ saved, toggleSave, isSaved, loading }}>
      {children}
    </SavedContext.Provider>
  );
}

export const useSaved = () => useContext(SavedContext);