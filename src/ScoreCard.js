import 'bootstrap/dist/css/bootstrap.min.css';
import './ScoreCard.css';

function ScoreCard({ player }) {
	return (
		<div className='score-card' key={player.email}>
			<div className='d-flex justify-content-between'>
				<div className='sc-name'>{player.name}</div>
				<div className='sc-score align-self-end'>{player.score}</div>
			</div>
		</div>
	);
}

export default ScoreCard;
