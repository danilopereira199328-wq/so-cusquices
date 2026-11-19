import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function CommentsSection({ postId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setComments(list);
    });

    return () => unsubscribe();
  }, [postId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user || submitting) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        text: text.trim(),
        author: user.displayName,
        authorPhoto: user.photoURL,
        authorId: user.uid,
        createdAt: serverTimestamp(),
      });
      setText('');
    } catch (error) {
      console.error('Erro ao comentar:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
    } catch (error) {
      console.error('Erro ao apagar comentário:', error);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
      {comments.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start gap-2.5 bg-gray-800/60 p-2.5 rounded-lg text-sm"
            >
              <Link to={`/profile/${comment.authorId}`}>
                <img
                  src={comment.authorPhoto}
                  alt={comment.author}
                  className="w-6 h-6 rounded-full object-cover mt-0.5"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/profile/${comment.authorId}`}
                      className="font-semibold text-white hover:underline text-xs"
                    >
                      {comment.author}
                    </Link>
                    <span className="text-[11px] text-gray-500">
                      {comment.createdAt?.toDate().toLocaleString('pt-PT') || 'Agora'}
                    </span>
                  </div>

                  {user?.uid === comment.authorId && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-gray-500 hover:text-red-400 text-xs transition"
                      title="Apagar comentário"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-gray-200 mt-1 break-words whitespace-pre-wrap">
                  {comment.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddComment} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreve um comentário..."
          className="flex-1 bg-gray-800 text-sm text-white placeholder-gray-500 rounded-full px-3.5 py-1.5 outline-none border border-gray-700 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-1.5 rounded-full transition"
        >
          {submitting ? '...' : 'Comentar'}
        </button>
      </form>
    </div>
  );
}