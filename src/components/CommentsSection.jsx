import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { createNotification } from './NotificationsBell';

export default function CommentsSection({ postId, postAuthorId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setComments(data);
    });

    return () => unsubscribe();
  }, [postId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user || submitting) return;

    const cleanText = text.trim();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        text: cleanText,
        author: user.displayName || 'Utilizador',
        authorPhoto: user.photoURL || '',
        authorId: user.uid,
        createdAt: serverTimestamp(),
      });

      if (postAuthorId && postAuthorId !== user.uid) {
        await createNotification({
          recipientId: postAuthorId,
          sender: user,
          type: 'comment',
          postId,
          postPreview: cleanText,
        }).catch((err) => console.error('Erro ao criar notificação de comentário:', err));
      }

      setText('');
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-3">
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-xs text-neutral-500">Ainda sem comentários.</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="flex items-start gap-2 bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/60"
            >
              <Link to={`/profile/${comment.authorId}`} className="shrink-0">
                <img
                  src={comment.authorPhoto}
                  alt={comment.author}
                  className="w-6 h-6 rounded-full object-cover mt-0.5"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/profile/${comment.authorId}`}
                    className="text-xs font-bold text-neutral-200 hover:underline"
                  >
                    {comment.author}
                  </Link>
                  <span className="text-[10px] text-neutral-500">
                    {comment.createdAt?.toDate().toLocaleString('pt-PT') || 'Agora'}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5 break-words">
                  {comment.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {user && (
        <form onSubmit={handleAddComment} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            placeholder="Escreve um comentário..."
            className="flex-1 bg-neutral-800 text-xs sm:text-sm text-white placeholder-neutral-500 rounded-xl px-3 py-2 outline-none border border-neutral-700 focus:border-blue-500 transition"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition active:scale-95"
          >
            {submitting ? '...' : 'Enviar'}
          </button>
        </form>
      )}
    </div>
  );
}