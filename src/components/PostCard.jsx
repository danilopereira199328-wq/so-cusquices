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
  showAuthor = true,
  children, // Aqui entra o CommentsSection
}) {
  const { user } = useAuth();
  const { toggleFollow, isFollowing } = useFollow();
  const [showComments, setShowComments] = useState(false);

  const hasLiked = post.likes?.includes(user?.uid);
  const catInfo = CATEGORIES_MAP[post.category] || { label: 'Geral', icon: '💬' };
  const authorFollowed = isFollowing(post.authorId);
  const isOwner = user?.uid === post.authorId;

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition">
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
                onClick={() => onDelete(post.id)}
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

          <div className="mt-3 flex items-center gap-5">
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
              💬 {showComments ? 'Ocultar comentários' : 'Comentários'}
            </button>
          </div>

          {showComments && children}
        </div>
      </div>
    </div>
  );
}