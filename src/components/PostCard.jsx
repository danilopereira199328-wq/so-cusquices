import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../context/FollowContext';

const CATEGORIES_MAP = {
  nacional: { label: 'Nacional', icon: '🇵🇹' },
  internacional: { label: 'Internacional', icon: '🌍' },
  famosos: { label: 'Famosos', icon: '⭐' },
  produtos: { label: 'Produtos', icon: '📦' },
  pessoas: { label: 'Pessoas Comuns', icon: '👥' },
};

export default function PostCard({
  post,
  onLike,
  onDelete,
  onBookmark,
  onRepost,
  isBookmarked = false,
  showAuthor = true,
  children,
}) {
  const { user } = useAuth();
  const { toggleFollow, isFollowing } = useFollow();
  const [showComments, setShowComments] = useState(false);

  const hasLiked = post.likes?.includes(user?.uid);
  const catInfo = CATEGORIES_MAP[post.category] || { label: 'Geral', icon: '💬' };
  const authorFollowed = isFollowing(post.authorId);
  const isOwner = user?.uid === post.authorId;

  const handleConfirmDelete = () => {
    if (window.confirm('Tens a certeza que queres apagar esta cusquice?')) {
      onDelete(post);
    }
  };

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition">
      {post.repostedBy && (
        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
          🔁 Partilhado por <span className="font-semibold text-gray-400">{post.repostedBy}</span>
        </p>
      )}

      <div className="flex items-start gap-3">
        {showAuthor && (
          <Link to={`/profile/${post.authorId}`}>
            <img
              src={post.authorPhoto}
              alt={post.author}
              className="w-10 h-10 rounded-full object-cover"
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center flex-wrap gap-1.5">
              {showAuthor && (
                <Link
                  to={`/profile/${post.authorId}`}
                  className="font-bold text-white hover:underline"
                >
                  {post.author}
                </Link>
              )}

              {showAuthor && user && !isOwner && (
                <button
                  onClick={() => toggleFollow(post.authorId)}
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold transition ${
                    authorFollowed
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  }`}
                >
                  {authorFollowed ? 'A seguir' : '+ Seguir'}
                </button>
              )}

              <span className="text-base">{post.country === 'PT' ? '🇵🇹' : '🇧🇷'}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {catInfo.icon} {catInfo.label}
              </span>
              <span className="text-gray-500 text-xs">
                {post.createdAt?.toDate().toLocaleString('pt-PT') || 'Agora'}
              </span>
            </div>

            {isOwner && onDelete && (
              <button
                onClick={handleConfirmDelete}
                className="text-gray-500 hover:text-red-500 text-sm transition"
                title="Apagar publicação"
              >
                🗑️
              </button>
            )}
          </div>

          <p className="text-gray-200 mt-2 whitespace-pre-wrap break-words">{post.text}</p>

          {post.imageUrl && (
            <div className="mt-3">
              <img
                src={post.imageUrl}
                alt="Imagem da publicação"
                className="max-h-96 w-full object-cover rounded-xl border border-gray-800"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-5">
              <button
                onClick={() => onLike(post.id, post.likes)}
                className={`flex items-center gap-1 text-sm transition ${
                  hasLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-400'
                }`}
              >
                {hasLiked ? '❤️' : '🤍'} {post.likes?.length || 0}
              </button>

              <button
                type="button"
                onClick={() => setShowComments((prev) => !prev)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-400 transition"
              >
                💬 {showComments ? 'Ocultar' : 'Comentar'}
              </button>

              {onRepost && !isOwner && (
                <button
                  type="button"
                  onClick={() => onRepost(post)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-400 transition"
                  title="Partilhar no teu feed"
                >
                  🔁 Partilhar
                </button>
              )}
            </div>

            {onBookmark && (
              <button
                type="button"
                onClick={() => onBookmark(post.id)}
                className={`text-sm transition ${
                  isBookmarked ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-300'
                }`}
                title={isBookmarked ? 'Remover dos guardados' : 'Guardar cusquice'}
              >
                {isBookmarked ? '🔖 Guardado' : '📑 Guardar'}
              </button>
            )}
          </div>

          {showComments && children}
        </div>
      </div>
    </div>
  );
}