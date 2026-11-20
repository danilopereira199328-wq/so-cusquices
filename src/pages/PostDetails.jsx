import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { 
  doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp 
} from 'firebase/firestore';

export default function PostDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      const docRef = doc(db, 'posts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    };
    fetchPost();

    const q = query(collection(db, 'posts', id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(commentsData);
    });

    return () => unsubscribe();
  }, [id]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addDoc(collection(db, 'posts', id, 'comments'), {
        text: newComment,
        author: user.displayName,
        authorPhoto: user.photoURL,
        authorId: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error("Erro ao comentar:", error);
    }
  };

  if (loading) return <div className="text-center text-gray-500 mt-10">A carregar...</div>;
  if (!post) return <div className="text-center text-gray-500 mt-10">Post não encontrado.</div>;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 p-4 flex items-center gap-4 sticky top-0 bg-black/90 backdrop-blur-md z-10">
        <Link to="/" className="text-2xl">←</Link>
        <h1 className="text-xl font-bold">Post</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 mb-6">
          <div className="flex items-start gap-3">
            <img src={post.authorPhoto} alt={post.author} className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <Link to={`/profile/${post.authorId}`} className="font-bold text-white hover:underline">
                {post.author}
              </Link>
              <p className="text-gray-200 mt-2 whitespace-pre-wrap">{post.text}</p>
              <p className="text-gray-500 text-xs mt-2">
                {post.createdAt?.toDate().toLocaleString('pt-PT')}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleAddComment} className="mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escreve um comentário..."
            className="w-full bg-transparent text-white placeholder-gray-500 resize-none outline-none mb-2"
            rows={2}
          />
          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={!newComment.trim()}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-1 px-4 rounded-full transition text-sm"
            >
              Comentar
            </button>
          </div>
        </form>

        <h3 className="text-lg font-bold mb-4">Comentários ({comments.length})</h3>
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center">Ainda não há comentários.</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                <div className="flex items-start gap-3">
                  <img src={comment.authorPhoto} alt={comment.author} className="w-8 h-8 rounded-full" />
                  <div className="flex-1">
                    <Link to={`/profile/${comment.authorId}`} className="font-bold text-white text-sm hover:underline">
                      {comment.author}
                    </Link>
                    <p className="text-gray-200 text-sm mt-1 whitespace-pre-wrap">{comment.text}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {comment.createdAt?.toDate().toLocaleString('pt-PT')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}