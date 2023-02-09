import 'bootstrap/dist/css/bootstrap.min.css';
import players from './data.json';
import Container from 'react-bootstrap/Container';

import './App.css';
import ScoreCard from './ScoreCard';

function App() {
	return (
		<div className='App vh-100'>
			<Container id='main-container' className='mx-auto d-flex justify-content-center'>
				<div className='flex-col align-items-center'>
					<h1 id='page-title'>Leaderboard</h1>
					<div id='results'>
						{players.map((player) => {
							console.log('player:');
							return <ScoreCard player={player} />;
						})}
					</div>
				</div>
			</Container>
		</div>
	);
}

export default App;
