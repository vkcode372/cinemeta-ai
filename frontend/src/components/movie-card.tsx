import Link from 'next/link';
import { Icon } from './icon';
import type { Movie } from '@/lib/api';

const colors = ['poster-violet', 'poster-red', 'poster-blue', 'poster-amber', 'poster-green'];

export function MovieCard({ movie, index = 0 }: { movie: Movie; index?: number }) {
  return (
    <Link className="movie-card" href={`/movies/${movie.id}`}>
      <div className={`movie-poster ${colors[index % colors.length]}`}>
        {movie.posterUrl ? <img src={movie.posterUrl} alt="" /> : <><span className="poster-glow" /><span className="poster-title">{movie.title.split(':')[0]}</span><span className="poster-mark"><Icon name="play" size={16} /></span></>}
        <span className="rating-badge"><Icon name="star" size={13} /> {Number(movie.rating).toFixed(1)}</span>
      </div>
      <div className="movie-meta"><div><h3>{movie.title}</h3><p>{movie.genre} <span>·</span> {movie.language}</p></div><span className="movie-arrow"><Icon name="arrow" size={16} /></span></div>
    </Link>
  );
}
