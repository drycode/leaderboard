import 'bootstrap/dist/css/bootstrap.min.css';
import './ScoreCard.css';

function ScoreCard({ player }) {
	return (
		<div className='score-card d-flex' key={player.email}>
			<span className='sc-name'>{player.name}</span>
			<span className='sc-score'>{player.score}</span>
		</div>
	);
}

export default ScoreCard;
